# -*- coding: utf-8 -*-
# 변칙 검출: 옵션명에 연령/대상이 남아있으면(=형태가 아닌 값) 플래그
import openpyxl, re
ws = openpyxl.load_workbook(r"C:\Users\김건우\Downloads\상품매핑.xlsx", data_only=True).active
rows = list(ws.iter_rows(values_only=True))

# 옵션명에 있으면 안 되는 것 (연령/월령/대상)
SUS = re.compile(r'(\d+\s*개월|\d+\s*세|\d\s*학년|초등|중등|고등|영아|유아|아동용|청소년|성인용|성인기|노인용|대학생|부모용|교사용|자기보고|보고형)')

anom = {}
for r in rows[1:]:
    name = str(r[1] or ''); opt = str(r[2] or ''); code = str(r[6] or '')
    clean = re.sub(r'\([^()]*공용[^()]*\)', '', opt)        # 공용 적용범위 괄호 제외
    if any(x in clean for x in ['활용법', 'CD', '도서']):   # 도서/부록명 제외
        clean = ''
    m = SUS.search(clean)
    if m:
        anom.setdefault(name, []).append((opt, m.group(1), code))

total = sum(len(v) for v in anom.values())
print(f"=== 변칙 옵션명: {total}개 / 검사군 {len(anom)}개 ===")
for name, v in list(anom.items())[:30]:
    kws = set(x[1] for x in v)
    print(f"[{name}]  (걸린 키워드: {', '.join(kws)})")
    for opt, kw, code in v[:3]:
        print(f"   「{opt}」  ({code})")
