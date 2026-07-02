# -*- coding: utf-8 -*-
"""
검사 위계 시드 툴 (seed_hierarchy)
================================================================
소스 : 상품매핑.xlsx  (build_hierarchy.py 산출물 = DB 시드 단일 진실 소스)
대상 : Supabase Postgres
  - test_groups  : (약어, 검사명) 조합으로 dedup 하여 upsert → id 확보
  - products     : product_code 로 매칭하여 검사 위계 컬럼만 UPDATE
                   (test_group_id / option_name / option_label / is_common
                    / sort_order / is_active)

★ 절대 원칙
  - products.category 는 절대 UPDATE 대상 아님 (시트 빈칸 26행 = 판매중지 3종.
    원본 products.category 는 '검사'로 채워져 있고 CHECK(검사/도서/도구) 제약이 걸려
    빈 문자열/NULL 을 밀어넣으면 CHECK 위반. category 는 이 스크립트가 손대지 않음).
  - is_active 는 "시트 category 칸이 빈 행 = 판매중지" 인 상품만 false 로 설정.
    나머지 행은 is_active 를 UPDATE 페이로드에 넣지 않음 (DB DEFAULT true 유지).
  - RLS/스키마 무변경. 데이터 UPDATE·INSERT 만.

★ 멱등성
  - test_groups: (abbr, name) 로 조회 → 없으면 INSERT, 있으면 sort_order 재정렬만
    UPDATE. abbr/name 에 UNIQUE 제약이 없으므로(스키마 설계상, 1약어→N검사명 실측)
    유일키 판정을 스크립트가 (abbr, name) 키로 직접 수행 → 재실행해도 중복 생성 0.
  - products: product_code(유일) 로 개별 UPDATE. 재실행해도 동일 결과.

★ 실행 순서 (README 참조)
  1) 마이그레이션 3개를 SQL Editor 로 먼저 적용 (test_groups → products 컬럼 → is_active)
  2) dry-run 으로 요약 검증 (검사군 수·미매칭·판매중지 대상 확인)
  3) --apply 로 실적재

사용:
  # dry-run (기본) — DB 미변경, 요약만 출력
  export SUPABASE_URL="https://xxxx.supabase.co"
  export SUPABASE_SERVICE_KEY="sb_secret_..."      # 서비스 롤 키 (RLS 우회 필요)
  python scripts/seed_hierarchy.py

  # 실적재
  python scripts/seed_hierarchy.py --apply

  # 소스 경로 지정 (기본: Downloads/상품매핑.xlsx)
  python scripts/seed_hierarchy.py --src "D:/경로/상품매핑.xlsx" --apply

의존성: pip install openpyxl supabase
================================================================
"""
import os
import sys
import argparse
from collections import OrderedDict, defaultdict, Counter

import openpyxl

# 윈도우 콘솔(cp949) 한글 깨짐 방지 — UTF-8 출력 강제 (Python 3.7+)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

DEFAULT_SRC = r"C:\Users\김건우\Downloads\상품매핑.xlsx"

# 상품매핑.xlsx 컬럼 인덱스 (0-base)
C_ABBR, C_NAME, C_OPT, C_HEAD, C_COMMON, C_OPTSORT, C_CODE, C_ORIG, C_CAT = range(9)


def _norm(v):
    """셀 값 → 트림된 문자열. None/공백은 ''."""
    if v is None:
        return ""
    return str(v).strip()


def _norm_or_none(v):
    """빈 문자열은 None (abbr 등 nullable 컬럼용)."""
    s = _norm(v)
    return s if s else None


def load_rows(src_path):
    """상품매핑.xlsx 를 읽어 dict 리스트로 반환 (헤더 제외)."""
    wb = openpyxl.load_workbook(src_path, read_only=True, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    out = []
    for raw in rows[1:]:  # 헤더 스킵
        if not raw or raw[C_CODE] is None:
            continue
        code = _norm(raw[C_CODE])
        if not code:
            continue
        # 옵션정렬: 정수 우선, 실패 시 None
        try:
            opt_sort = int(raw[C_OPTSORT]) if raw[C_OPTSORT] not in (None, "") else None
        except (TypeError, ValueError):
            opt_sort = None
        out.append({
            "abbr": _norm_or_none(raw[C_ABBR]),
            "name": _norm(raw[C_NAME]),
            "option_name": _norm_or_none(raw[C_OPT]),
            "option_label": _norm_or_none(raw[C_HEAD]),
            "is_common": _norm(raw[C_COMMON]).upper() == "Y",
            "opt_sort": opt_sort,
            "product_code": code,
            "orig_name": _norm(raw[C_ORIG]),
            "category_cell": _norm(raw[C_CAT]),   # 빈칸이면 판매중지 신호 (DB엔 안 씀)
        })
    return out


def build_plan(rows):
    """
    적재 계획 생성 (순수 함수 — DB 접근 없음).
    반환:
      groups       : [(abbr, name)] 등장순 (검사군 sort_order 부여용)
      product_plan : product_code -> {test_group_key, option_name, option_label,
                                       is_common, sort_order, is_active(옵션)}
      stopped_codes: 판매중지(category 빈칸) product_code 집합
    """
    # 1) 검사군 dedup = (abbr, name), 등장순 유지 (시트는 이미 가나다 정렬)
    group_order = OrderedDict()  # key=(abbr,name) -> True
    for r in rows:
        group_order[(r["abbr"], r["name"])] = True
    groups = list(group_order.keys())

    # 2) 검사군별 옵션 재넘버링: (opt_sort asc, 원본행순 asc) → 1..N
    #    opt_sort 가 None 인 행은 맨 뒤 (큰 값 취급).
    per_group_rows = defaultdict(list)
    for idx, r in enumerate(rows):
        per_group_rows[(r["abbr"], r["name"])].append((idx, r))

    product_plan = {}
    stopped_codes = set()
    for gkey, items in per_group_rows.items():
        items_sorted = sorted(
            items,
            key=lambda t: (
                t[1]["opt_sort"] if t[1]["opt_sort"] is not None else 10 ** 9,
                t[0],  # 원본 행순 (동률 tie-break)
            ),
        )
        for new_order, (_, r) in enumerate(items_sorted, start=1):
            entry = {
                "test_group_key": gkey,
                "option_name": r["option_name"],
                "option_label": r["option_label"],
                "is_common": r["is_common"],
                "sort_order": new_order,
            }
            # 판매중지: 시트 category 칸이 빈 행만 is_active=false
            if r["category_cell"] == "":
                entry["is_active"] = False
                stopped_codes.add(r["product_code"])
            product_plan[r["product_code"]] = entry

    return groups, product_plan, stopped_codes


def summarize(rows, groups, product_plan, stopped_codes):
    """dry-run / apply 공통 요약 출력."""
    print("=" * 64)
    print("[요약] 상품매핑.xlsx → 검사 위계 시드 계획")
    print("=" * 64)
    print(f"  데이터 행수(=상품 수)     : {len(rows)}")
    print(f"  검사군 수 (약어,검사명 dedup): {len(groups)}")

    # 무결성: product_code 유일·빈값
    codes = [r["product_code"] for r in rows]
    dup = {k: v for k, v in Counter(codes).items() if v > 1}
    empty = sum(1 for c in codes if not c)
    print(f"  product_code 빈값         : {empty}  (기대 0)")
    print(f"  product_code 중복         : {len(dup)}  (기대 0){'' if not dup else ' → ' + str(dup)}")

    # 한 약어 → 복수 검사명 (별개 검사군 확인)
    abbr2names = defaultdict(set)
    for a, n in groups:
        abbr2names[a].add(n)
    multi = {a: v for a, v in abbr2names.items() if len(v) > 1}
    print(f"  한 약어 → 복수 검사명     : {len(multi)}건 (각각 별개 검사군으로 생성)")
    for a, v in list(multi.items())[:10]:
        label = a if a else "(약어없음)"
        print(f"      - {label}: {len(v)}개 검사명")

    # 판매중지 (is_active=false 대상)
    print(f"  is_active=false 대상 상품 : {len(stopped_codes)}  (시트 category 빈칸 = 판매중지)")
    stopped_groups = defaultdict(int)
    for code in stopped_codes:
        gk = product_plan[code]["test_group_key"]
        stopped_groups[gk] += 1
    for (abbr, name), cnt in stopped_groups.items():
        print(f"      - [{abbr or '-'}] {name}: {cnt}개 상품")

    # 검사군 내 옵션정렬 중복 (재넘버링 되었는지 확인용 정보)
    raw_dup_groups = 0
    tmp = defaultdict(list)
    for r in rows:
        tmp[(r["abbr"], r["name"])].append(r["opt_sort"])
    for k, v in tmp.items():
        c = Counter(x for x in v if x is not None)
        if any(cnt > 1 for cnt in c.values()):
            raw_dup_groups += 1
    print(f"  시트상 옵션정렬 중복 그룹 : {raw_dup_groups}  (검사군별 재넘버링으로 해소)")
    print("=" * 64)


def get_client():
    """서비스 롤 키로 supabase 클라이언트 생성 (RLS 우회)."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[에러] 환경변수 SUPABASE_URL / SUPABASE_SERVICE_KEY 필요.", file=sys.stderr)
        print("       서비스 롤 키(sb_secret_...)를 사용해야 RLS를 우회해 시드할 수 있습니다.", file=sys.stderr)
        sys.exit(2)
    try:
        from supabase import create_client
    except ImportError:
        print("[에러] pip install supabase 필요.", file=sys.stderr)
        sys.exit(2)
    return create_client(url, key)


def apply_seed(rows, groups, product_plan, stopped_codes):
    """실적재. 멱등 — 재실행해도 검사군 중복 생성 0."""
    sb = get_client()

    # --- 1) test_groups upsert (멱등: (abbr,name) 조회 후 없으면 insert) ---
    # abbr/name 에 UNIQUE 제약이 없어 DB onConflict 불가 → 스크립트가 키로 판정.
    print("\n[1/2] test_groups upsert ...")
    existing = sb.table("test_groups").select("id, abbr, name, sort_order").execute().data or []
    key2id = {(_norm_or_none(e.get("abbr")), _norm(e.get("name"))): e["id"] for e in existing}

    inserted, updated = 0, 0
    for sort_idx, (abbr, name) in enumerate(groups, start=1):
        gkey = (abbr, name)
        if gkey in key2id:
            gid = key2id[gkey]
            # 정렬만 재동기화 (등장순). 그 외 필드는 운영자 보정 존중 → 건드리지 않음.
            sb.table("test_groups").update({"sort_order": sort_idx}).eq("id", gid).execute()
            updated += 1
        else:
            res = sb.table("test_groups").insert({
                "abbr": abbr,               # None 이면 NULL
                "name": name,
                "sort_order": sort_idx,
                # category / is_active 는 DB DEFAULT 사용 (category=NULL, is_active=true)
                # category 는 여기서도 절대 세팅하지 않음.
            }).execute()
            gid = res.data[0]["id"]
            key2id[gkey] = gid
            inserted += 1
    print(f"      검사군 신규 {inserted} / 정렬갱신 {updated} (총 {len(groups)})")

    # --- 2) products UPDATE (product_code 매칭. category 절대 미포함) ---
    print("[2/2] products 검사 위계 컬럼 UPDATE ...")
    ok, miss = 0, []
    for r in rows:
        code = r["product_code"]
        plan = product_plan[code]
        gid = key2id[plan["test_group_key"]]
        payload = {
            "test_group_id": gid,
            "option_name": plan["option_name"],
            "option_label": plan["option_label"],
            "is_common": plan["is_common"],
            "sort_order": plan["sort_order"],
            # category 는 절대 넣지 않음 (CHECK 위반 방지)
        }
        if "is_active" in plan:                 # 판매중지 상품만 명시적으로 false
            payload["is_active"] = plan["is_active"]
        res = sb.table("products").update(payload).eq("product_code", code).execute()
        if res.data:                            # 매칭된 행이 있으면 data 반환
            ok += 1
        else:
            miss.append(code)
    print(f"      상품 UPDATE 성공 {ok} / 미매칭 {len(miss)}")
    if miss:
        print("      [경고] DB에 없는 product_code (미매칭):")
        for c in miss:
            print(f"        - {c}")
    print("\n[완료] 시드 종료.")


def main():
    ap = argparse.ArgumentParser(description="검사 위계 시드 (상품매핑.xlsx → Supabase)")
    ap.add_argument("--src", default=DEFAULT_SRC, help="상품매핑.xlsx 경로")
    ap.add_argument("--apply", action="store_true", help="실적재 (미지정 시 dry-run)")
    args = ap.parse_args()

    if not os.path.exists(args.src):
        print(f"[에러] 소스 파일 없음: {args.src}", file=sys.stderr)
        sys.exit(2)

    rows = load_rows(args.src)
    groups, product_plan, stopped_codes = build_plan(rows)
    summarize(rows, groups, product_plan, stopped_codes)

    if not args.apply:
        print("\n[DRY-RUN] DB 미변경. 위 요약 확인 후 --apply 로 실적재하세요.")
        print("          (검사군 수 ~214 / 미매칭 0 / is_active=false 대상 확인)")
        return

    print("\n[APPLY] 서비스 롤 키로 실적재를 시작합니다.")
    apply_seed(rows, groups, product_plan, stopped_codes)


if __name__ == "__main__":
    main()
