# A10 — 학회 통합 목록 뷰 (Event Hub List) · P0

> 비전: **"학회 운영 OS — 한 학회의 모든 것이 한 페이지에."**
> L1 연간 목록(이 문서) → L2 학회 통합 상세(비-P0) → L3 연차 자산 누적(비-P0)
> 상태: **기획(2차 구체화).** §11 결정(Q1~Q3) 확정 후 시안/구현 위임.

## 1. 개요·목표
- 학회를 "운영 대상" 단위로 한 화면에 나열 + 학회관리 CRUD 겸용(dual-purpose). 행 클릭 → L2(비-P0).
- 목표: ① 연간/반기 현황 조망 ② 진행상태(기안/신청/지결) 추적 ③ 운영필드 입력 ④ 현장 모바일.
- Pain: 현장에서 "내가 갈 다음 학회" 정보가 한 곳에 없음. 데이터 80%는 이미 시스템 내 존재.

## 2. 컬럼 (9종) + 데이터 출처
| # | 컬럼 | 출처 |
|---|------|------|
| 1 | 번호 | 행 순번(표시용, 영구 ID 아님) |
| 2 | 학회명 | `events.host_society` |
| 3 | 행사명 | `events.event_season` |
| 4 | 날짜 | `events.start_date~end_date` |
| 5 | 장소 | **신규 `venue text`** |
| 6 | 참석자 | **신규 `attendee_ids uuid[]`** (어드민 user 멀티선택) |
| 7 | 비고 | **신규 `note text`** |
| 8 | 진행상태 | **신규 3 boolean** (기안/신청/지결) |
| 9 | 비용 | **신규 `marketing_cost integer`** |

## 3. 신규 필드 최종 스키마 (events ADD COLUMN, 멱등, 비운영일 적용)
```
venue                    text
attendee_ids             uuid[]            -- user_profiles.id 참조 배열
note                     text
marketing_cost           integer           -- 원
draft_done               boolean DEFAULT false   -- 기안
application_done         boolean DEFAULT false   -- 신청
payment_resolution_done  boolean DEFAULT false   -- 지결(지출결의)
```
- (1차의 `progress_stage` 5단계 enum 폐기.) RLS: events 정책 상속.

## 4. 참석자 (어드민 멀티선택)
- **저장 = `attendee_ids uuid[]`(참조).** 이름 변경에 강함(사용자관리 이름 변경 기능 존재). 표시 시 후보목록과 join → 항상 현재 이름. (연 800건이라 uuid[] 단일컬럼이 join테이블보다 적합 — 과설계 회피.)
- **후보 source = `user_profiles` 클라이언트 SELECT** (RLS authenticated 허용 20260607 → list-users Edge Fn 불필요. feedback.js/bulletins.js의 profileMap 선례).
- **후보 범위 = [Q1]** 권고: **현장마케팅(onsite)+master** (출고는 현장 미참석).
- **표시:** 3명까지 이름 칩 / 4명+는 `{첫1명} 외 N명`. 미입력 "—".
- **필터:** 드롭다운 source=후보목록 + **"나" 빠른필터 칩**.
- **정합 방어:** 삭제된 user의 잔존 uuid는 join 실패 시 "(삭제)"로 표시·무시 (FK/트리거 미도입 — 표시단 방어로 충분).

## 5. 진행상태 (3 boolean 토글)
- `draft_done`·`application_done`·`payment_resolution_done` 독립 3개(순차 강제 X — 실제로 별개 사무절차).
- **표시: 인라인 3칩** `기안 ● 신청 ● 지결 ○` (완료=채워진 brand soft 칩, 미완=빈 중립 칩).
- **인라인 토글 = [Q3]** 권고: events:edit 권한자 칩 직접 클릭 즉시 토글(낙관적+롤백). ⚠️ 현재 onsite는 events:view만 보유 → onsite도 토글하려면 events:edit 권한 추가 필요(Q3와 연결).
- **다른 축 관계:** 시간상태(예정/진행중/종료)=getEventStatusKST 자동, 보조 라벨. **결제완료=주문 status에서 파생(L2, P0 아님)**, **참석완료=별도 추적 안 함**(시간상태 종료로 갈음).

## 6. 행 인터랙션 / 위계
- **행 본문 클릭 → L2 상세**(P0는 라우트 입구만). 인라인칩·⋯메뉴는 `stopPropagation`.
- **음영(위계 다운) = 시간상태 '종료' 행** (bg gray-50, 텍스트 secondary). ※1차의 "참석완료 음영"은 progress 5단계 폐기로 변경됨.
- **Upcoming 하이라이트 = [Q2]** 권고: **"로그인한 내가 attendee인 미래 가장 가까운 1건"**(master=전체 미래 1건, 내 참석 0건이면 전체 다음 1건 폴백). 좌측 brand 보더/약한 틴트.

## 7. 검색 필터
- 날짜 단축: 올해(`event_year`)/상반기(1~6월)/하반기(7~12). **기본=올해.**
- 학회명 드롭다운: distinct `host_society`. 참석자 드롭다운: 후보목록 + "나".
- **정렬 기본: `start_date 오름차순`**(다가오는 학회 위).

## 8. 현장 모바일/태블릿
- 9컬럼 → 모바일 **카드**(OrderManagement 카드 패턴): 상단 학회명+행사명+진행상태칩 / 중단 날짜·장소·참석자 / 하단 비고·비용. 음영·하이라이트=카드 bg/보더.

## 9. Dual-purpose 화면 구조 (조망 + CRUD)
| 작업 | 위치 | 위계 |
|---|---|---|
| 운영 조망(메인) | 표 9컬럼 | L1 |
| 등록/수정 | 우상단 "추가" → 다이얼로그(CRUD + 운영필드 venue/note/marketing_cost/attendee_ids) | 모달 |
| 진행상태 변경 | **인라인 칩 토글** | 인라인 |
| 삭제·URL/QR | 행 우측 ⋯ 메뉴 | 행 액션 |
| L2 진입 | 행 본문 클릭 | 라우트 |
> 원칙: 보기=행 / 편집=다이얼로그 / 빠른상태=인라인칩 / 부가=⋯ / 깊이=행클릭.

## 10. 권한·빈상태·표시형식
- events:view=읽기, events:edit=운영필드·CRUD·진행토글, master=삭제(+전체 Upcoming).
- 빈상태 EmptyState "해당 조건의 학회가 없어요"+필터해제. 비용 `#,##0원`("—"). 

## 11. 확정 필요 결정
- **Q1 참석자 후보 범위:** (a)현장마케팅+master [권고] (b)전체 어드민 (c)출고 포함.
- **Q2 Upcoming 범위:** 내 참석 다음 1건(master 전체·0건 폴백) [권고] / 항상 전체 다음 1건.
- **Q3 진행상태 인라인 토글:** 허용[권고, onsite는 events:edit 권한 추가 시] / 다이얼로그에서만.

## 12. P0 범위 / 비-P0
- P0: 9컬럼 목록 + 음영(종료)/Upcoming + 3필터 + 신규필드 입력(다이얼로그) + 인라인 진행토글 + 행클릭→L2 라우트.
- 비-P0: L2 상세 조립(field_reports·orders·매출·결의서), 캘린더, L3 자산, 메모/이미지.

## 조사 출처
AuthContext.jsx:26-44(로그인 user.id/role/permissions), feedback.js/bulletins.js(user_profiles id,name 클라SELECT 선례), 20260607(user_profiles authenticated SELECT), events 스키마(20260313060000), getEventStatusKST(utils/date.js).
