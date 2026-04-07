# 개발 로드맵

> 이 파일은 향후 개발 방향과 미완료 기능을 기록합니다.

---

## 📍 현재 상태 (2026-04-07 기준)

| 구분 | 상태 |
|------|------|
| 서비스 단계 | **정식** — 알림톡 연동 완료 |
| 알림톡 | 결제완료(paid) 시 자동 발송, 어드민 재발송 버튼 |
| 이메일 수집 | 제거됨 (알림톡으로 대체) |
| RLS 보안 | ⚠️ 미처리 — 정식 운영 중 처리 필요 |

### 정식 전환 완료 체크리스트
- [x] 알림톡 채널 심사 통과
- [x] 알림톡 API 연동 (원샷 msgagent, 결제완료 시 자동 발송)
- [x] 어드민 재발송 버튼 (`OrderDetailModal`)
- [x] 이메일 필드 제거 (주문 폼, DB nullable 처리)
- [ ] RLS DB function 수정 (아래 🔒 참조)
- [ ] 어드민 "링크 복사" 버튼 제거 (베타 잔재)

---

## 🔴 우선순위 높음

### 🔒 RLS anon SELECT 보안 강화 — 필수
**배경:**
- `orders` 테이블 `USING (true)` → anon key로 전체 주문 조회 가능
- anon key는 프론트엔드 JS 번들에 공개됨
- **현재:** UUID 난수 토큰으로 실질 위험은 낮으나, 운영 규모 커지면 위험

**해결 방법:** `SECURITY DEFINER` DB function으로 토큰 기반 조회만 허용 + anon SELECT RLS 삭제

```sql
CREATE FUNCTION get_order_by_token(p_token uuid) RETURNS json
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT row_to_json(o) FROM (
    SELECT o.*, json_agg(oi) FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    WHERE o.access_token = p_token GROUP BY o.id
  ) o;
$$;
```

---

### [베타 잔재] 어드민 "링크 복사" 버튼 제거
알림톡 연동 완료로 더 이상 필요 없음. 베타 배지와 함께 `OrderDetailModal`에서 제거.

수정 위치: `src/components/OrderDetailModal.jsx`

---

### [부분 취소] 기획 필요
고객이 특정 상품만 취소하는 경우 퍼널:
카드 전체 환불 → 취소 상품 제외한 2차 주문 생성 → 재결제
→ **기획 확정 후 구현**

---

## 🟡 중간 우선순위

### ✅ [주문 조회] 고객용 주문 상태 페이지 (구현 완료)
- 라우트: `/order/status/:token`
- UUID access_token 기반, 로그인 불필요
- 연계 주문(parent_order_id) 병합 표시
- 배송 예정일 상태별 문구 분기

### ✅ [배송 예정일] 학회별 예상도착일 (구현 완료)
- DB: `events.estimated_delivery_date date` 추가 완료
- 주문서 최종 확인 단계 + 주문 상태 페이지 표시

### [주문 상태 페이지] 상태 배너 통합
주문 상세 상단에 상태 배너 + info Alert + warning Alert 3개가 쌓이는 문제.
단일 카드로 통합:

| 상태 | 카드 내용 |
|------|-----------|
| 결제대기 | 칩 + 접수일 + "지금 결제 시 N월 N일까지 90% 도착" |
| 결제완료 | 칩 + 접수일 + "N월 N일 도착 예정" |
| 출고완료 | 칩 + 접수일 + "N월 N일 도착 예정" |
| 처리완료 | 칩 + 접수일 |
| 취소류 | 칩 + 접수일 + "담당자에게 문의해 주세요" |

수정 위치: `src/components/OrderStatusPage.jsx`

---

## 🟢 낮은 우선순위

### [출고 완료 알림톡] 추가 템플릿
현재 `paid` (결제완료) 시 발송. 추후 `shipped` (출고완료) 시 별도 알림톡 추가 가능.
템플릿 별도 등록 필요 (원샷 → 카카오 심사).

### [주문 조회 페이지] 이름+연락처 조회 (Fallback) — 보류
보안 취약하므로 구현하지 않기로 결정. 알림톡 재발송이 이 역할 대체.

---

## ✅ 완료된 주요 작업
- **카카오 알림톡 연동** (2026-04-07): 원샷 msgagent API, 결제완료 자동 발송, 어드민 재발송 버튼
- **이메일 제거**: 주문 폼에서 이메일 수집 제거, DB nullable 처리
- 주문 상태 6단계로 단순화
- 어드민 전체 디자인 시스템 통일
- 대시보드 매출 계산 로직 수정 (배송비 분리, 취소/환불 제외)
- 출고현황 결제완료 전용 뷰
- 연계 주문 UI (주문관리 목록 포맷, 출고현황 병합, 주문상세 1차/2차 분리)
- 고객 주문 조회 페이지 (`/order/status/:token`) — UUID 토큰 기반
- 배송 예정일 (`events.estimated_delivery_date`)
- UUID access_token 도입 (순번 ID 열거 공격 차단)
- 어드민 주문 편집 배송비 계산 정가 기준 수정
- 상품관리 할인상품 카운트 수정
- 주문 검색 연락처 하이픈 무관 검색
