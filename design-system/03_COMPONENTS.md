# 03. 합성 컴포넌트 카탈로그

> 02(토큰)가 색·글씨·간격이라는 **단어**를 정했다면, 이 문서는 그 단어들을 모아 만든 **문장**이다. 시안 7개를 들여다보면 같은 의미의 패턴이 페이지마다 조금씩 다른 코드로 반복된다 — "라벨+값 한 줄", "주문 상태 칩", "가격 합계", "카드 하단 버튼 묶음", "빈 상태". 이 반복을 의미 단위로 고정한 것이 합성 컴포넌트다. D16에서 6종을 정했고, D14에 따라 wrapper가 아니라 **의미 단위**로 만든다.

## 왜 6종인가

토스 답습을 폐기하고 서비스 고유 시스템을 세우는 과정에서, 가장 먼저 드러난 문제는 "토큰이 부족해서"가 아니라 "**부르는 약속이 없어서**" 일관성이 깨진다는 것이었다(D14). 02 §타이포 §사용 규칙이 1차 약속이고, 이 6종은 2차 약속이다. 같은 의미는 같은 컴포넌트로 부른다. 그러면 페이지 작업자가 "여기 라벨+값을 어떻게 짜지"를 매번 새로 고민하지 않고, "InfoRow를 부른다"로 끝난다. 그 한 줄이 통일감을 만든다.

6종은 시안에서 실제로 가장 많이 반복된 패턴 순으로 뽑았다. 새로 발명한 게 아니라, 흩어져 있던 걸 모았다.

## 코드 위치

`inpsyt-order-frontend/src/components/ui/` 아래에 있고, `ui/index.js` 배럴에서 한 번에 꺼낸다.

```jsx
import { StatusBadge, InfoRow, PriceBlock, ActionSlot, EmptyState, SectionCard } from './ui';
```

카테고리 색은 02 §색 / 08 D17의 정식 토큰을 코드로 옮긴 `constants/categoryColors.js`에서 가져온다. 글로벌 `theme.js`는 건드리지 않는다(토큰 마이그레이션은 별도 사이클).

---

## 1. StatusBadge — 상태·종류를 칩으로

### 무엇을 의미하는가

화면에는 두 가지 "이것은 무엇인가"가 칩으로 나타난다. 하나는 **주문 상태**(결제완료·결제대기·처리완료·주문취소·결제취소), 다른 하나는 **상품 종류**(도서·검사). 둘은 의미가 다르다 — status는 "이 주문이 지금 어떤 상태인가", category는 "이 상품이 어떤 종류인가". 02 §색에서 정한 대로, 의미가 다르니 형태도 다르게 둔다. status는 채움(soft)에 점을 달고, category는 테두리(outlined)만 둔다. `category-test`(#6366F1)와 `status-completed`가 헥사가 우연히 같아도, 형태가 다르면 운영자가 헷갈리지 않는다(D17).

기존 `StatusChip`(점+테두리 형태)을 흡수·정합한 버전이다. StatusChip은 status를 outlined로 그렸는데, D17이 status=filled를 요구하므로 StatusBadge가 정본이다. StatusChip은 아직 일부 시안이 쓰고 있어 남겨두되, 점진적으로 StatusBadge로 교체한다(deprecated 예정).

### props

| prop | 타입 | 설명 |
|---|---|---|
| `kind` | `'status'` \| `'category'` | 기본 `'status'` |
| `value` | string | status: `paid`·`pending`·`completed`·`cancelled`·`refunded` / category: `book`·`test` |
| `label` | node | 라벨 직접 지정(미지정 시 value에서 한글 자동 매핑) |
| `size` | `'sm'` \| `'md'` | 기본 `'md'` |
| `dot` | boolean | status일 때 좌측 점 표시(기본 true). category는 항상 점 없음 |
| `sx` | object | |

### 사용 예시

```jsx
<StatusBadge value="paid" />                          {/* 결제완료 칩 */}
<StatusBadge value="completed" size="sm" />           {/* 작은 처리완료 칩 */}
<StatusBadge kind="category" value="book" size="sm" /> {/* 도서 (outlined) */}
```

### 어디서 쓰는가

주문 관리(상태 칼럼), 출고 현황(주문 행의 상태·분류 칩), 상품 관리(카테고리 칩), 주문 상태(고객) 등 상태·종류가 표시되는 모든 자리.

---

## 2. InfoRow — 라벨 + 값 한 줄

### 무엇을 의미하는가

"연락처: 010-...", "도로명: ...", "인싸이트 ID: ..." 처럼 **라벨과 값이 한 줄로 짝지어 표시되는 자리**다. 출고 현황과 주문 상태 화면에서 가장 자주 등장한다. 시안마다 `DataLine`, `InfoRow`라는 이름으로 따로 정의돼 있던 걸 하나로 모았다. 우측에 복사 버튼을 옵션으로 달 수 있어, 출고 운영자가 값을 한 번에 클립보드로 가져간다.

라벨은 `caption` 토큰, 값은 `small`(body2) 토큰을 쓴다. 인라인 사이즈는 없다(02 §운영 조항 2). 복사 버튼은 학회장 50대 손가락 기준으로 hit-area 44×44를 채운다(02 §운영 조항 8) — 아이콘 자체는 작아도 누르는 영역은 넉넉하다.

### props

| prop | 타입 | 설명 |
|---|---|---|
| `label` | node | 라벨 |
| `value` | node | 값(문자열 또는 커스텀 노드) |
| `onCopy` | function | 지정 시 우측 복사 버튼 노출 |
| `mono` | boolean | 값을 monospace + tabular-nums로(연락처·ID·금액) |
| `muted` | boolean | 값을 보조색으로(빈 값 `-` 등) |
| `multiline` | boolean | 값이 여러 줄일 때 라벨 상단 정렬(주소·요청·메모) |
| `labelWidth` | number\|string | 라벨 고정 폭(기본 64px) |
| `sx` | object | |

### 사용 예시

```jsx
<InfoRow label="연락처" value="010-1234-5678" mono onCopy={() => copy(phone)} />
<InfoRow label="배송지" value="서울특별시 중구 명동길 26 5층" multiline />
<InfoRow label="요청" value={note || '-'} muted={!note} multiline />
```

### 어디서 쓰는가

출고 현황(고객 정보 6줄: 결제·연락처·ID·도로명·상세·요청·메모), 주문 상태(주문자 정보 카드), 주문 상세 드로어 등.

---

## 3. PriceBlock — 값을 읽는 자리

### 무엇을 의미하는가

가격은 본인 돈 쓰는 사용자가 두 번 보는 자리다(01 원칙 1). 배송비·1차/2차 결제금액 같은 **보조 행**이 쌓이고, 그 아래 구분선과 함께 **합계 행**이 온다. 합계 값은 본문보다 한 단계 또렷한 위계로 보여준다 — 02 §타이포 약속 4의 `number` 토큰 정신이다. 다만 안경 너머로 보는 사용자 기준에서 광고 배너처럼 키우지 않고, 위계를 만들 만큼만 키운다.

값을 읽는 자리이므로 숫자는 항상 tabular-nums. 합계 값 색은 옵션으로 줄 수 있어, 주문 상태 화면처럼 상태 배너 색을 따라가야 할 때 쓴다.

### props

| prop | 타입 | 설명 |
|---|---|---|
| `rows` | `{label, value, muted?}[]` | 합계 위 보조 금액 행. value 숫자면 자동 `원` 포맷 |
| `totalLabel` | node | 합계 라벨(예: '최종 결제금액') |
| `totalValue` | number\|string | 합계 금액 |
| `totalColor` | string | 합계 값 색(상태 배너 색 등). 미지정 시 text.primary |
| `divider` | boolean | 보조 행과 합계 사이 구분선(기본 true) |
| `sx` | object | |

### 사용 예시

```jsx
<PriceBlock
  rows={[{ label: '배송비', value: '무료', muted: true }]}
  totalLabel="최종 결제금액"
  totalValue={89250}
  totalColor={banner.color}
/>
```

### 어디서 쓰는가

주문 상태(결제 요약 카드), 주문서 비용 요약, 주문 상세 결제 정보 등 합계가 표시되는 모든 자리.

---

## 4. ActionSlot — 카드·모달 하단 액션 묶음

### 무엇을 의미하는가

카드·모달·툴바 하단에서 버튼들이 줄 서는 자리다. 시안마다 `<Box sx={{ display:'flex', gap:1, ml:'auto' }}>`로 손수 짜던 걸 의미 단위로 모았다. 배치 규칙을 컴포넌트가 강제한다 — 주 액션은 우측 끝(우→좌 우선순위), 위험 액션(삭제 등)은 `leading` 슬롯으로 분리해 주 액션과 거리를 둔다. 버튼 사이 간격은 8px(space-sm)로 고정해 손가락 빗나감을 막는다(02 §간격, §운영 조항 8).

### props

| prop | 타입 | 설명 |
|---|---|---|
| `children` | node | 우측 정렬 액션(우선순위 높은 게 우측 끝) |
| `leading` | node | 좌측 정렬 슬롯(위험 액션, 보조 정보·라벨) |
| `justify` | `'flex-start'`\|`'center'`\|`'space-between'` | leading 없을 때 정렬(기본 `flex-end`) |
| `wrap` | boolean | 좁은 폭 줄바꿈(기본 true) |
| `sx` | object | |

### 사용 예시

```jsx
<ActionSlot leading={<><Typography variant="subtitle2">단축 복사</Typography>{copyButtons}</>}>
  <Button variant="outlined">출고 완료 처리</Button>
</ActionSlot>

{/* 위험 액션 분리 */}
<ActionSlot leading={<Button color="error" variant="outlined">선택 삭제</Button>}>
  <Button variant="contained">저장</Button>
</ActionSlot>
```

### 어디서 쓰는가

출고 카드 액션 행, 모달 하단(상품 편집·삭제·일괄 편집), 일괄 액션 바 등.

---

## 5. EmptyState — 빈 상태와 다음 행동

### 무엇을 의미하는가

데이터가 없을 때 "비었습니다"로 끝내지 않는다(01 원칙 4). 아이콘 + 제목 + 부제 + **다음 행동 버튼**으로, 사용자가 무엇을 하면 되는지 알려준다. 제목은 `title-card`(subtitle1), 부제는 `small`(body2) 토큰. 인라인 사이즈 없음.

기존 `components/EmptyState.jsx`(토큰 미정합, h6/raw 사이즈)를 대체하는 정합 버전이다. 실 페이지 5곳(주문·상품·학회·피드백·사용자 관리)이 아직 기존 버전을 import하고 있어, 점진 마이그레이션 대상이다. 새 화면·시안은 `ui/EmptyState`를 쓴다.

### props

| prop | 타입 | 설명 |
|---|---|---|
| `icon` | ElementType | MUI 아이콘 컴포넌트(기본 InboxOutlined) |
| `title` | node | 빈 상태 제목 |
| `description` | node | 보조 안내 |
| `action` | `{label, onClick, startIcon?}` | 다음 행동 버튼 |
| `sx` | object | |

### 사용 예시

```jsx
<EmptyState
  icon={LocalShippingIcon}
  title="출고 대기 주문이 없습니다"
  description="필터를 조정해 주세요"
/>

<EmptyState
  title="검색 결과가 없습니다"
  action={{ label: '필터 초기화', onClick: reset, startIcon: <RestartAltIcon /> }}
/>
```

### 어디서 쓰는가

출고 현황·상품 관리·주문 관리의 빈 리스트, 검색 결과 없음 등.

---

## 6. SectionCard — 정보 한 덩어리

### 무엇을 의미하는가

"한 덩어리의 정보가 묶이는 자리"다(02 Primitives §Card). 우리 어드민에서 가장 자주 등장한다. 헤더 슬롯(아이콘 + 제목 + 부제 + 우측 액션)과 본문을 갖는다. 카드 라운드·그림자·내부 여백이 토큰에 묶여 있어 페이지마다 다른 카드가 생기지 않는다.

6종 중 유일하게 이미 존재하던 컴포넌트다. 이번 사이클에서 6종 일관 API에 맞춰 제목의 인라인 `fontWeight`·`letterSpacing`을 걷어내고 `subtitle1` variant에 위임했다(시각 동일, 토큰 정합). 카드 안에 카드를 또 넣지 않는다 — 그러고 싶어지면 정보 구조가 잘못된 것이다.

### props

| prop | 타입 | 설명 |
|---|---|---|
| `title` | node | 카드 제목(subtitle1) |
| `subtitle` | node | 보조 |
| `icon` | ElementType | 헤더 좌측 아이콘 |
| `action` | node | 헤더 우측 액션 슬롯 |
| `children` | node | 본문 |
| `padding` | number | 내부 여백(기본 24). 행 리스트형 카드는 0 |
| `interactive` / `onClick` | | 클릭 가능 카드(hover elevation) |
| `sx` | object | |

### 사용 예시

```jsx
<SectionCard title="필터" icon={FilterListIcon} action={<Button>초기화</Button>}>
  {filterRows}
</SectionCard>

<SectionCard padding={0}>{/* 행 리스트형: 내부에서 px/py 직접 제어 */}</SectionCard>
```

### 어디서 쓰는가

필터 영역, 테이블 래퍼, 출고 그룹 카드, 결제 요약 등 거의 모든 어드민 화면.

---

## 합성 컴포넌트를 늘리고 싶을 때

02 §토큰을 늘리고 싶을 때와 같은 절차를 밟는다. "이 패턴이 정말 여러 화면에서 같은 의미로 반복되는가"를 먼저 묻는다. 한 화면에서만 쓰는 패턴이면 그건 합성 컴포넌트가 아니라 그 화면의 로컬 컴포넌트다. 여러 화면에서 같은 의미로 반복될 때만 ui/로 올린다. 새로 올릴 때는 (1) 인라인 사이즈·weight 없이 Typography variant·토큰만 쓰고, (2) raw hex 없이 토큰만 쓰고, (3) JSDoc으로 props API와 "어떤 의미 단위인가"를 적고, (4) `ui/index.js` 배럴에 등록한다. 이 약속이 6개월 뒤 다시 색 60종·패턴 중복으로 돌아가는 걸 막는다.

## 변경 이력

- 2026-05-27: D16 합성 컴포넌트 6종 신설. StatusBadge·InfoRow·PriceBlock·ActionSlot·EmptyState 코드 작성, SectionCard 점검·정합. 출고 시안(FulfillmentPreview) 검증 리팩터 — InfoRow·StatusBadge·ActionSlot·EmptyState 적용, 인라인 fontSize·raw hex 0 달성. 카테고리 색을 `constants/categoryColors.js`로 코드 격리(D17 정합).
