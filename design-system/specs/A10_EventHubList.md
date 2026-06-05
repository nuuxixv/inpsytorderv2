# A10 — 학회 통합 목록 뷰 (Event Hub List) · P0

> 비전: **"학회 운영 OS — 한 학회의 모든 것이 한 페이지에."**
> L1 연간 목록(이 문서) → L2 학회 통합 상세(비-P0) → L3 연차 자산 누적(비-P0)
> 상태: **기획(draft).** §결정 확정 전 시안/구현 위임 금지.

## 1. 개요·목표
- **한 줄:** 학회를 "운영 대상" 단위로 한 화면에 나열. 행 클릭 → L2 상세(비-P0)로 진입하는 단일 입구.
- **목표:** ① 연간/반기 학회 현황 조망 ② 진행상태(기안~참석) 추적 ③ 신규 5필드 입력 ④ 현장 모바일/태블릿 접근.
- **Pain:** 현장에서 두레이/노션 접속이 번거로움 → 학회 정보가 한 곳에 모이지 않아서. 데이터의 80%는 이미 이 시스템에 존재.

## 2. 컬럼 (건우님 확정 9종) + 데이터 출처 매핑
| # | 컬럼 | 출처 | 비고 |
|---|------|------|------|
| 1 | 번호 | **행 순번(표시용)** | 영구 ID 아님(정렬·필터 따라 변동). 내부 키는 events.id |
| 2 | 학회명 | `events.host_society` | 기존 |
| 3 | 행사명 | `events.event_season` | 기존(예: 춘계학술대회) |
| 4 | 날짜 | `events.start_date`~`end_date` | 기존 |
| 5 | 장소 | **신규 `venue text`** | 신규 입력 |
| 6 | 참석자 | **신규 `attendees text`** | 콤마 구분 문자열(참석자 드롭다운 source) |
| 7 | 비고 | **신규 `note text`** | 자유 메모 1줄 |
| 8 | 상태 | **신규 `progress_stage text`** | 기안→신청→지결→결제→참석 (시간상태와 별개) |
| 9 | 비용 | **신규 `marketing_cost integer`** | 원 단위 |

> 기존 `events.name`(전체명)·`order_url_slug`·`discount_rate`·`estimated_delivery_date`는 이 목록에 미노출(학회관리 CRUD/L2에 잔존).
> `status`/`getEventStatusKST`(예정/진행중/종료)는 **시간 기반 자동 상태**, 신규 `progress_stage`는 **운영 워크플로 상태** — 다른 축이며 공존(progress가 주, 시간상태는 보조 라벨).

## 3. 신규 필드 스키마 (events에 ADD COLUMN — 수동 적용)
```
venue          text
attendees      text
note           text
marketing_cost integer
progress_stage text DEFAULT '기안'
```
- 멱등(IF NOT EXISTS) 마이그레이션, 비운영일 대시보드 SQL 적용.
- RLS: 기존 events 정책 상속(읽기 events:view, 쓰기 events:edit/master).

## 4. 진행상태(progress_stage)
- 5단계 순차: **기안 → 신청 → 지결(지출결의) → 결제 → 참석(완료)**
- 전이: 기본 순행, 자유 점프·되돌리기 허용(소수 master 운영).
- 시각: StatusBadge 5색. 기안/신청=중립, 지결/결제=진행(앰버), 참석=완료(그린 약채도).

## 5. 행 인터랙션 / 위계
- **행 클릭 → L2 학회 상세 라우트**(P0는 입구만, 내용은 비-P0).
- **참석완료 행(`progress_stage='참석'`) = 음영 다운**(bg gray-50, 텍스트 secondary).
- **Upcoming 하이라이트:** `오늘 < start_date` 중 **가장 가까운 1건**만 강조(좌측 brand 보더/약한 틴트). [결정3]

## 6. 검색 필터
- **날짜 단축버튼:** 올해(`event_year=현재연도`) / 상반기(월 1~6) / 하반기(7~12). **기본=올해.** [결정2]
- **학회명 드롭다운:** distinct `host_society`.
- **참석자 드롭다운:** `attendees` 콤마 split → distinct.
- **정렬 기본:** `start_date 오름차순`(다가오는 학회 위). [결정2]

## 7. 현장 사용 (모바일/태블릿)
- 9컬럼 → 모바일은 **카드 레이아웃**(OrderManagement 모바일 카드 패턴 재사용): 상단 학회명+행사명+진행상태 뱃지 / 중단 날짜·장소·참석자 / 하단 비고·비용. 음영·하이라이트는 카드 bg/보더로.
- 태블릿 세로: 표 유지, 비고/비용 축약 가능.

## 8. 권한·빈상태·표시형식
- 권한: events:view=읽기, events:edit=신규필드·CRUD, master=삭제(기존 A5 그대로).
- 빈상태: 조건 0건 → EmptyState "해당 조건의 학회가 없어요" + 필터 해제.
- 비용 `#,##0원`(미입력 "—"), 참석자 칩 N개/"외 N명" 축약.

## 9. 연동 방식 [결정1 — 권고: 확장]
- **권고: 별도 화면 신설 ❌ / 기존 "학회 관리(A5/EventManagementPage)"를 이 통합 목록으로 확장 ⭕.**
- 근거: 이미 "학회=행" 표가 있음. 둘로 쪼개면 같은 데이터 이중관리·동기화 부담. 연 800건엔 단일 화면이 맞다.
- 방식: A5→A10 진화. CRUD(추가/수정 다이얼로그·삭제·URL/QR)는 유지(다이얼로그에 "운영 정보" Step 신설). 표 컬럼을 9종으로 교체 + 행 클릭=L2 진입. URL/QR은 행 호버 액션 또는 L2 내부로 이동.

## 10. P0 범위 / 비-P0
- **P0:** 9컬럼 목록 + 음영/하이라이트 + 3필터 + 신규 5필드 입력(다이얼로그) + 행 클릭→L2 라우트 진입.
- **비-P0:** L2 상세 조립(field_reports·orders·매출·입금결의서·audit_log), 캘린더 뷰(만들지 않음), L3 자산누적, 메모/이미지 첨부.

## 11. 확정 필요 결정
1. **연동방식:** 학회관리 표 확장(권고) vs 별도 화면.
2. **기본 정렬·필터:** start_date 오름차순 + 기본 "올해"(권고) vs 현 desc 유지.
3. **Upcoming 하이라이트 범위:** 다음 1건만(권고) vs 예정 전체.
4. **progress_stage 입력 위치:** 학회관리 다이얼로그 신규 Step vs 목록 행 인라인 변경.
5. **신규 5필드 ADD COLUMN 마이그레이션** 진행 승인(비운영일 적용).

## 조사 출처
- events 실제 컬럼: EventManagementPage.jsx:92 SELECT (`id,name,discount_rate,order_url_slug,start_date,end_date,estimated_delivery_date,event_year,host_society,event_season,status`).
- 시간상태: utils/date.js `getEventStatusKST`. 기존 사양: A5_EventManagementPage.md.
