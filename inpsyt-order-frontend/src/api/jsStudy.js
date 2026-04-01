// 👨‍🏫 [CTO의 코드 해설: src/api/products.js]
// 이 파일의 역할: 프론트엔드(식당 홀)에 상주하며 시스템 백엔드(DB 창고)로
// "메뉴판 데이터 좀 가져와!"라고 심부름을 전담하는 '통신병'입니다.

import { supabase } from '../supabaseClient';
// 💡 import: 다른 파일에서 만들어둔 도구나 부품을 빌려오는 명령어입니다. 
// 비유: "우리 식당의 만능 무전기(supabase)를 다른 방에서 가져오겠다."

/**
 * [JSDoc 주석] 이 별모양 블록은 코드가 아니라, 나중에 다른 개발자가 이 함수에 마우스를 올렸을 때 
 * "아, 이 함수는 이런 재료(파라미터)를 넣으면 이런 결과(리턴)가 나오는구나" 하고 
 * 툴팁 설명서를 띄워주기 위해 작성한 '친절한 매뉴얼'입니다. (기능적으론 돌지 않음)
 */
export const fetchProducts = async ({ searchTerm, category, tags, isPopularOnly = false, isNewOnly = false, currentPage = 1, productsPerPage = 10 }) => {
  // 💡 export: 이 통신병(함수)을 외부(메뉴판 화면 등)에서도 부를 수 있게 허락해 주는 문법.
  // 💡 async / await: (가장 중요!) 데이터를 가져오는 '비동기 통신' 문법.
  // 창고에 심부름을 다녀오면 0.5초라도 시간이 걸리겠죠? 
  // 화면이 화면 멈춤(렉) 없이 다른 일을 할 수 있게 "이 심부름(await) 끝날 때까지만 기다려줘!"라고 선언하는 문법입니다.

  // 1. 심부름꾼에게 기본 지시사항을 줍니다. "창고(products 테이블)에 가서 전부(*) 가져오고, 총개수(exact)도 세어와!"
  // 💡 let: 중간에 포스트잇처럼 내용물이 바뀔 수 있는 '임시 변수상자'를 만들 때 씁니다.
  let query = supabase.from('products').select('*', { count: 'exact' }); 

  // 2. 만약 손님이 검색창에 글자(searchTerm)를 쳤다면?
  if (searchTerm) {
    // 🔎 ilike: 대소문자 무시하고 일치하는 단어가 들어간 상품만 찾으라고 조건을 덧붙입니다.
    query = query.ilike('name', `%${searchTerm}%`);
  } else if (tags && tags.length > 0) {
    // ** 저자로 검색할 필요도 있겠다는 생각 **
    // 검색어는 없고 학회 태그(tags)가 있다면? 그 태그가 붙은 상품만 찾습니다.
    query = query.overlaps('tags', tags);
  }

  // 3. 필터: 특정 카테고리(도서, 검사 등) 칩을 눌렀다면?
  if (category) {
    // 🔎 eq (equal): 카테고리 칸이 해당 글자와 완벽히 똑같은 것만 걸러라!
    query = query.eq('category', category);
  }

  // 4. 필터: 인기/신상품 칩을 켰다면?
  if (isPopularOnly) {
    query = query.eq('is_popular', true); // "인기상품 뱃지 달린 것만!"
  }
  if (isNewOnly) {
    query = query.eq('is_new', true);     // "신상 뱃지 달린 것만!"
  }
  
  // 5. 정렬 기준 명시
  // "인기상품인 걸 제일 위로 올리고(ascending: false), 그다음은 이름 가나다순으로 메뉴판 차곡차곡 쌓아!"
  query = query.order('is_popular', { ascending: false }).order('name');

  // 6. 페이징 처리 (자르기)
  // 비유: "창고에 1000개가 있어도 화면 사이즈상 무조건 한 번에 10개(productsPerPage)씩만 카트에 실어와!"
  const from = (currentPage - 1) * productsPerPage; // 페이지 시작 번호 계산 (예: 11번부터)
  const to = from + productsPerPage - 1;            // 페이지 끝 번호 계산 (예: 20번까지)
  
  // 💡 const: 절대 내용물이 변하지 않는 굳건한 '불변 변수상자'를 만들 때 씁니다.
  query = query.range(from, to);

  // 7. 본격적인 심부름 출발!! (await)
  // 1번부터 6번까지 포스트잇에 덕지덕지 적어놓은 심부름 조건(query)을 들고 드디어 DB 창고로 출발합니다.
  const { data, error, count } = await query; 

  // 8. 심부름꾼이 오다가 넘어졌다면 (에러 발생)
  if (error) {
    console.error('Error fetching products:', error); // 콘솔(개발자도구)에 빨간 글씨로 족적을 남기고
    throw error; // 에러를 이 함수를 호출한 곳(메뉴판 화면)으로 뻥!! 집어던집니다. "나 실패했어!!"
  }

  // 9. 심부름 성공: 가져온 물건 뭉치(data)와 전체 상품 개수(count)를 짠! 하고 돌려줍니다.
  return { data, count }; 
};


/**
 * 모든 상품 목록을 한 번에 다 긁어오는 무식하지만 강력한 심부름꾼 
 * (주로 화면에 뿌릴 때 안 쓰고, 관리자가 '엑셀 다운로드' 등을 누를 때 씁니다)
 */
export const fetchAllProducts = async () => {
  const allProducts = []; // 일단 텅 빈 거대한 장바구니 배열([]) 하나를 준비합니다.
  const limit = 1000;     // Supabase가 서버 보호를 위해 한 번에 줄 수 있는 최대치(1000개)로 제한을 둡니다.
  let offset = 0;         // "어디서부터 가져올까?" (시작점)
  let hasMore = true;     // "창고에 물건이 더 남았나?" (판별 스위치)

  // 💡 while: 괄호 안의 스위치(hasMore)가 꺼지지 않는 한, 무한 반복해서 빙글빙글 도는 쳇바퀴 문법입니다.
  // 비유: "어이, 창고에 물건 진열 끝날 때까지 1000개 단위로 계속 퍼와라!"
  while (hasMore) {
    // 0번째부터 999번째까지 일단 가져와봐! (await)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching products in chunk:', error);
      throw error; // 넘어지면 즉시 중단하고 에러 집어던지기
    }

    // 창고에서 가져온 물건(data)이 있고, 그 개수가 0보다 크다면?
    if (data && data.length > 0) {
      allProducts.push(...data);  // 거대한 장바구니에 1000개를 쏟아붓습니다. (push)
      offset += data.length;      // 시작점을 방금 가져온 1000개 뒤로 미룹니다 (다음 바퀴를 위해).
    } else {
      // 이제 진짜로 창고에 남은 게 한 개도 없다면, 쳇바퀴 전원 스위치를 확 내립니다! (루프 탈출)
      hasMore = false;
    }
  }
  
  // N바퀴를 돌아 가득 찬 최종 장바구니를 보고합니다.
  return allProducts;
};


---

/*
 fetchProducts (조건 검색 심부름꾼)

어디서 부르나? 

ProductSelectionStep.jsx
 (손님들이 보는 상품 선택 화면)
언제 부르나? 손님이 화면에 처음 들어왔을 때, 카테고리 칩(도서/검사)을 눌렀을 때, 검색창에 글자를 칠 때 실시간으로 이 함수를 부릅니다. (10개씩 페이징 처리해서 빠르게 휙휙 가져옴)



fetchAllProducts (무식하게 다 긁어오는 심부름꾼)

어디서 부르나? 
 (전부 어드민 화면들입니다!)
어드민이 "전체 상품 엑셀 다운로드" 버튼을 눌렀을 때 씁니다. 페이징 10개씩 가져오면 엑셀을 못 만드니까 한방에 다 긁어오는 거죠.
[최적화 꼼수] 어드민 장부(orders)에는 상품 이름이 없고 상품ID: 5번 이런 식으로 숫자만 저장되어 있습니다.
장부를 볼 때마다 DB에 "5번 이름 뭐야?"를 1000번 물어보면 창고가 마비되겠죠? 그래서 어드민 화면이 켜지자마자
이 함수로 전체 메뉴판을 한 번에 다 긁어와서 메모리(RAM)에 백과사전처럼 펼쳐두고,
5번이 보이면 즉각 "아, 심리학 개론이네" 하고 화면에 글자를 변환시켜 뿌려주기 위해 씁니다.
*/


[CTO의 냉정한 결론: 우리 방식, 고쳐야 할까요?]

"당장 에러가 나진 않겠지만, 이번 V2 리팩토링에서는 무조건 고쳐야 하는 1순위 기술 부채입니다." 지금은 주문 장부를 열 때 3초 정도 빙글빙글 돌고 참을만하게 열리겠지만, 주문 내역이 쌓이고 상품군이 1만 개가 넘어가면 어느 날 어드민 페이지 버튼을 눌렀는데 화면 자체가 하얗게 10초 동안 멈춰버리는 끔찍한 '브라우저 프리징' 현상을 맞이하게 될 겁니다.

궁금증이 완벽하게 해소되셨길 바랍니다! 냉정한 진단을 마치고, 다음 스터디인 [2단계: React 컴포넌트 화면과 상태의 기초 - 

CustomerInfoStep.jsx
] 파일을 열쇠로 딸 준비를 모두 마쳤습니다.


---

// 👨‍🏫 [CTO의 코드 해설: src/components/CustomerInfoStep.jsx 핵심 로직]
// [어디서 부르나?] OrderPage.jsx (주문 전체 관제탑 부모 화면)가 2단계 탭을 열 때 이 자식 화면을 불러옵니다.
// 💡 import: React가 제공하는 기본 도구(Hook)들과 카카오 주소찾기 같은 외부 부품을 빌려옵니다.
import React, { useState, useMemo } from 'react';
import DaumPostcode from 'react-daum-postcode'; 
// 💡 컴포넌트(화면 부품) 시작
// 💡 Props (파라미터): 부모 화면(OrderPage)이 이 자식을 부를 때 손에 들려준 쇼핑백입니다.
// 부모 왈: "야, 여기 정보 몽땅 담아놓을 커다란 쇼핑백(customerInfo)이랑, 글씨 칠 때마다 갱신할 무전기(setCustomerInfo) 줄 테니까 확실하게 채워와!"
const CustomerInfoStep = ({ customerInfo, setCustomerInfo, hasOnlineCode = false, isOnsitePurchase = false }) => {
  
  // 💡 useState: 화면 바깥으론 안 나가고, 이 화면 안에서만 임시로 기억하는 '내부 포스트잇'입니다.
  // "주소검색 모달창이 열려있나(true/false)?"를 기억합니다. 초기값은 false(닫힘)입니다.
  const [isPostcodeModalOpen, setIsPostcodeModalOpen] = useState(false);
  // 버튼을 누르면 이 함수들이 실행되어 포스트잇의 글자를 true/false로 뗐다 붙였다 합니다. (창이 열리고 닫힘)
  const handleOpenPostcode = () => setIsPostcodeModalOpen(true);
  const handleClosePostcode = () => setIsPostcodeModalOpen(false);
  // 1. 주소 검색 완료 시 실행되는 함수
  // 카카오 우편번호 창에서 클릭이 끝나면 `data`라는 상자에 결과물을 담아서 이 함수로 던져줍니다.
  const handleCompletePostcode = (data) => {
    let fullAddress = data.address; // 카카오가 준 기본 주소
    let extraAddress = '';
    // 한국 주소 특성상 '동/로/가' 혹은 '건물명'을 괄호()로 예쁘게 합치는 노가다 로직입니다.
    if (data.addressType === 'R') {
      if (data.bname !== '') extraAddress += data.bname;
      if (data.buildingName !== '') extraAddress += (extraAddress !== '' ? `, ${data.buildingName}` : data.buildingName);
      fullAddress += (extraAddress !== '' ? ` (${extraAddress})` : '');
    }
    // 💡 가장 핵심!: 부모가 준 무전기(setCustomerInfo)를 켭니다.
    // "이전 정보(prevState)에 있던 이름, 이메일 같은 건 ...기호로 그대로 복붙하고, 우편번호(postcode)랑 주소(address)만 방금 카카오에서 받은 걸로 덮어씌워서 무전 칠게!"
    setCustomerInfo(prevState => ({
      ...prevState,
      postcode: data.zonecode,
      address: fullAddress,
    }));
    
    handleClosePostcode(); // 입력 끝났으니 모달창 닫기
  };
  // 2. 전화번호 자동 하이픈(-) 입력기
  const handlePhoneChange = (e) => {
    // 키보드로 친 모든 글자(e.target.value)를 가져온 뒤,
    // 정규식(replace)을 써서 숫자가 아닌 글자(ㄱㄴㄷ, 특수기호 등)는 전부 빈칸('')으로 날려버립니다.
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    let formattedValue = rawValue;
    // 숫자의 길이에 따라 3글자 / 4글자 / 4글자 사이에 짝대기(-)를 예쁘게 끼워 넣는 마법의 슬라이스(slice) 조각내기입니다.
    if (rawValue.length > 3 && rawValue.length <= 7) {
      formattedValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3)}`;
    } else if (rawValue.length > 7) {
      formattedValue = `${rawValue.slice(0, 3)}-${rawValue.slice(3, 7)}-${rawValue.slice(7, 11)}`;
    }
    
    // 가공이 끝난 예쁜 번호(010-1234-5678)를 다시 무전(setCustomerInfo)을 쳐서 부모 쇼핑백에 담습니다.
    setCustomerInfo(prevState => ({ ...prevState, phone: formattedValue }));
  };
  // 3. 가장 평범한 텍스트(이름 등) 입력기
  const handleChange = (e) => {
    // 💡 여기서 name은 내가 만지고 있는 입력칸의 이름(예: 'name')이고, value는 키보드로 친 글자(예: '김기획')입니다.
    const { name, value } = e.target;
    
    // 부모에게 무전: "[이름]칸에 '김기획'이라고 쳤대! 덮어씌워!"
    setCustomerInfo(prevState => ({ ...prevState, [name]: value }));
  };
  // 4. 이메일 자동완성 도우미 (useMemo)
  // 💡 useMemo: 메모장처럼 '복잡한 연산 결과를 미리 적어두고 킵해두는' 기능입니다. (가성비 최적화)
  // 맨 끝의 [customerInfo.email] 뜻: "손님이 '이메일 칸'에 글자를 치고 있을 때만 이 코드를 실행해라."
  const emailSuggestions = useMemo(() => {
    const email = customerInfo.email || '';
    
    // 만약 치고 있는 이메일 칸이 비었거나, 벌써 '@'를 쳐버렸다면? 도우미(도메인 추천)를 퇴근시킵니다([] 빈 배열 반환).
    if (!email || email.includes('@')) return [];
    
    // 그게 아니라 영문 아이디만 치고 있다면? 
    // 미리 만들어둔 EMAIL_DOMAINS 배열(네이버, 지메일 등)을 뱅뱅 돌면서(map), 내가 친 아이디 뒤에 찰싹 붙여서 추천 목록을 만들어줍니다.
    return EMAIL_DOMAINS.map(domain => `${email}${domain}`);
  }, [customerInfo.email]);
// ... 하단 렌더링(HTML) 껍데기 코드로 이어짐 ...

                                              /* 간혹 이름, 이메일 등에 ' '(공백)을 추가하는 경우가 있고
                                              이메일에서는 . 대신에 , 를 넣는 경우도 있는데
                                              그런 케이스를 방지하는 기능도 들어있는지 검토가 필요해.
                                              */


// 👨‍🏫 [CTO의 코드 해설: src/components/ProductSelectionStep.jsx 핵심 로직]
// [어디서 부르나?] 부모 화면인 OrderPage.jsx가 '1단계: 상품 선택 탭'을 켤 때 이 컴포넌트를 조립해 넣습니다.

// 💡 import: React의 3대장 훅(Hook)을 몽땅 가져옵니다. (상태, 생명주기, 메모리 최적화)
import React, { useState, useEffect, useCallback } from 'react';

// 1단계 스터디에서 뜯어봤던 바로 그 '심부름꾼'을 파일 외부에서 호출해 옵니다!
import { fetchProducts } from '../api/products'; 

const ProductSelectionStep = ({ cart, onCartChange, discountRate = 0, eventTags = [], eventName = '' }) => {
  
  // 💡 useState: 화면의 상태(기억력)를 관리합니다.
  const [products, setProducts] = useState([]); // 창고에서 가져올 상품 목록을 늘어놓을 '매대(빈 배열 [])'
  const [loading, setLoading] = useState(true); // 로딩 팽이가 돌고 있는지? (처음 켤 땐 무조건 true)
  const [searchTerm, setSearchTerm] = useState(''); // 손님이 검색창에 친 글자
  const [viewMode, setViewMode] = useState('popular'); // 인기/신규 칩
  const [selectedCategory, setSelectedCategory] = useState('all'); // 카테고리 칩

  // 1. 상품 불러오기 함수 (useCallback)
  // 💡 useCallback: 이 복잡한 함수 코드를 브라우저 캐시 메모리에 '임시 저장(기억)'해두는 문법입니다.
  // 사용자가 키보드를 칠 때마다 화면은 보이지 않게 수십 번 다시 그려지는데, 그때마다 이 함수를 새로 짜면 버벅대니까 "이전에 짜둔 거 복붙해!" 라며 최적화하는 기법입니다.
  const loadProducts = useCallback(async (search = '', mode = 'popular', category = 'all') => {
    
    setLoading(true); // "심부름꾼 출발한다, 화면에 빙글빙글 팽이 띄워!"
    
    try { // 안전모 착용 (에러가 나도 터지지 않게)
      
      // 심부름꾼(1단계 파일의 fetchProducts)에게 들려보낼 쪽지(파라미터)를 미리 작성합니다.
      const params = {
        searchTerm: search,
        tags: (mode !== 'all' && eventTags?.length > 0) ? eventTags : undefined,
        isNewOnly: mode === 'new',
        category: category !== 'all' ? category : undefined,
        productsPerPage: 100,
      };
      
      // 심부름꾼 드디어 출발! (await = 올 때까지 여기서 대기 타!)
      const { data } = await fetchProducts(params);
      
      // 💡 심부름꾼이 물건을 가져오면 매대(products)에 진열합니다. (이때 화면이 새로고침 되며 상품이 뜹니다)
      setProducts(data || []); 

    } catch (error) {
       addNotification('검색 실패', 'error'); // 실패하면 팝업 띄우기
    } finally {
      // 💡 finally: 성공하든 실패하든 "마지막엔 무조건" 이 코드를 실행하라는 뜻.
      setLoading(false); // "로딩 팽이는 멈춰라!"
    }
  }, [eventTags]); // 이 부분은 'eventTags'라는 외부 변수가 바뀔 때만 캐시를 폐기하고 함수를 새로 짜라는 명령입니다.


  // 2. [React 생명주기 1] 화면이 처음 켜질 때 '딱 한 번만!' (On Mount)
  // 💡 useEffect: 화면 렌더링 전후에 특정한 행동을 일으키는 트리거 방아쇠입니다.
  // 맨 뒤에 배열 `[loadProducts]`를 넣어두면, 이 컴포넌트가 "화면에 처음 뿅! 등장할 때" 알아서 이 괄호 안의 코드를 딱 1번 실행시킵니다.
  useEffect(() => {
    loadProducts('', 'popular', 'all'); // 즉, 창 열자마자 빈 검색어로 '인기상품 전체'부터 쫙 깔아주는 역할!
  }, [loadProducts]);


  // 3. [React 생명주기 2] 디바운스(Debounce) 최적화 검색 🌟🌟🌟 (가장 우아한 로직)
  // 이번 방아쇠의 감시 대상은 맨 밑에 적힌 `[searchTerm, viewMode, selectedCategory]` 세 마리입니다.
  // 제 셋 중 하나라도 내용이 바뀌면 무조건 이 안의 코드가 터집니다!
  useEffect(() => {
    
    // 💡 setTimeout: JavaScript의 타이머. "300밀리초(0.3초) 뒤에 괄호 안의 심부름꾼을 출발시켜라!"
    const timer = setTimeout(() => {
      loadProducts(searchTerm, viewMode, selectedCategory);
    }, 300);

    // 💡 클린업(Clean-up) 함수: 디바운스의 마법이 일어나는 반환 값(return)입니다!
    // 사용자가 '심리학'을 검색하려고 '심'을 쳤을 때 0.3초 타이머가 째깍째깍 돕니다.
    // 그런데 0.1초 만에 '리'를 쳐버리면? React가 이 return 문을 먼저 실행해서 원래 돌고 있던 0.3초 타이머를 찢어버립니다(clearTimeout).
    // 그리고 '심리'로 다시 0.3초 타이머를 처음부터 켭니다. 
    // 결과적으로 손님이 타자를 멈추고 온전히 0.3초가 지나서야 진짜 서버 통신 1번이 날아갑니다!! (서버 폭파 방지용 기술)
    return () => clearTimeout(timer);



                                                /*
                                                0.3초의라는 시간의 적절성에 대한 검토가 필요해! 우리 상품은 외래어도 많고 어려운 단어로 되어있기도 하고, 평균 구매자의 연령이
                                                결코 어리지 않아서 더 오랜 시간동안 검색어를 입력할 가능성이 있어. 꼭 이렇게 하겠다는 건 아니고 고려해보자.
                                                */
    
  }, [searchTerm, viewMode, selectedCategory, loadProducts]); 

  // 4. 장바구니에 담기 (부모에게 무전 치기)
  const handleAddProduct = (product) => {
    // 장바구니(cart) 배열을 돌면서(some), 방금 찌른 상품번호(id)가 이미 담겨 있는지 판별합니다.
    if (!cart.some(p => p.id === product.id)) {
      // 💡 안 담겨 있으면? 무전기(onCartChange)를 들어 부모 화면의 장바구니를 통째로 갈아치웁니다.
      // "기존 장바구니 안에 있던 거([...cart]) 싹 다 유지하고 뒤에 콤마(,) 찍은 다음에, 얘 정보 다 넣고({ ...product }) 개수는 1개(quantity: 1)로 쳐서 저장해!"
      onCartChange([...cart, { ...product, quantity: 1 }]);
    } else {
      addNotification('이미 추가된 상품입니다.', 'info');
    }
  };

// ... 뒤는 UI(화면 껍데기)를 그리는 HTML 코드로 이어집니다 ...


// 👨‍🏫 [CTO의 코드 해설: src/components/OrderPage.jsx 핵심 로직]
// [어디서 부르나?] 손님이 QR코드를 찍고 들어오면 가장 먼저 접속하게 되는 '주문 관제탑(부모 컴포넌트)'입니다.

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabaseClient';
// ... 껍데기용 UI 부품들 생략 ...

// 우리가 방금 앞선 스터디에서 뜯어본 '종업원(자식 화면)'들을 메인 홀로 불러옵니다.
import ProductSelectionStep from './ProductSelectionStep';
import CustomerInfoStep from './CustomerInfoStep';
import OrderReviewStep from './OrderReviewStep';

const OrderPage = () => {
  // 💡 1. 중앙 통제실의 기억 장치들 (useState)
  // 이 파일 하나가 3개의 탭(상품선택, 정보입력, 주문확인) 전체의 메모리를 혼자 다 껴안고 관리합니다.
  const [activeStep, setActiveStep] = useState(0); // 현재 손님이 몇 번째 탭에 있는지? (0=상품, 1=정보, 2=확인)
  const [cart, setCart] = useState([]); // 🛒 손님의 장바구니 현황 (너무 중요!)
  const [customerInfo, setCustomerInfo] = useState({ 
    name: '', email: '', phone: '', postcode: '', address: '' 
  }); // 🧑 손님의 신상정보

  // 💡 2. 계산기 (useMemo)
  // 장바구니(validCartItems)에 물건이 담기거나, 학회 할인율(discountRate)이 바뀔 때만 다시 계산해라!
  const totalPrice = useMemo(() => {
    // 🔎 reduce: 장바구니 배열을 빙글빙글 돌면서 금액을 차곡차곡 누적 합산(+)하는 마법의 함수입니다.
    return validCartItems.reduce((sum, item) => {
      // 할인이 되는 상품이면 할인가격으로, 아니면 원래 가격으로 더하기
      const price = item.is_discountable
        ? Math.round(item.list_price * (1 - discountRate))
        : item.list_price;
      return sum + price * item.quantity; // 누적금액 = 기존까지 더한 금액 + (상품가격 * 오늘 고른 개수)
    }, 0);
  }, [validCartItems, discountRate]);

  // 💡 3. 유효성 검사 (isSubmittable)
  // [다음] 혹은 [결제] 버튼을 회색으로 잠글지, 파란색으로 열어줄지 판별하는 스위치들입니다.
  const isCustomerInfoValid = customerInfo.name && customerInfo.email && customerInfo.phone;
  const isSubmittable = isCustomerInfoValid && hasCartItems;

  // 💡 4. 다음 단계로 넘어가기 버튼 (handleNext)
  const handleNext = () => {
    if (activeStep === 0) { // 지금 1단계 화면(상품 선택)일 때
      if (!hasCartItems) {  // 장바구니가 텅 비었으면?
        setError('상품을 1개 이상 담아주세요.'); // 팝업으로 혼내고
        return; // 못 넘어가게 튕겨냅니다. (이 코드가 없으면 빈 주문이 들어감)
      }
      // 통과했다면? 현재 스텝을 1(두 번째 탭)로 바꿔서 화면을 넘겨버립니다!
      setActiveStep(1); 
      window.scrollTo(0, 0); // 화면 맨 위로 스크롤 올려주기 매너
    }
  };

  // 💡 5. 최종 결제(제출) 버튼 (handleSubmitOrder)
  // 앞선 '시즌 2 딥다이브' 스터디에서 우리가 봤던 백엔드 Edge Function(create-order)을 호출하는 심장부입니다!
  const handleSubmitOrder = async () => {
    setIsSubmitting(true); // "결제 중입니다..." 팽이 띄우기

    try {
      // 🚀 백엔드 창고로 로켓 쏘기! (invoke)
      const { data, error: invokeError } = await supabase.functions.invoke('create-order', {
        body: {
          customer_name: customerInfo.name, 
          email: customerInfo.email,
          phone_number: customerInfo.phone,
          // 여기서 방금 전 1단계 탭에서 받아둔 '장바구니 배열(cart)'을 포장해서 냅다 백엔트로 던져버립니다!
          cart: validCartItems.map(item => ({ product_id: item.id, quantity: item.quantity })),
          event_id: eventInfo.id,
        },
      });

      // 💥 로켓이 가다가 터지면(invokeError) 아래 에러 처리로 날려버리고,
      if (invokeError) throw invokeError;

      // 무사히 도착하면 "결제 성공 창"을 띄워줍니다.
      setSubmittedOrderId(data?.order?.id || null);
      setShowSuccessDialog(true);
      
    } catch (error) {
      setError(`주문 처리 중 오류가 발생했습니다.`);
    } finally {
      setIsSubmitting(false); // 팽이 끄기
    }
  };


  // 👇 6. 실제 화면에 뿌려주는 부분 (Props 던져주기 🌟🌟🌟)
  // 어떻게 화면 스위칭을 하나요? if문( && )으로 갈아 끼웁니다.
  return (
    <Box>
      {/* 만약 지금 0번째 탭이라면? 상품 선택 화면 컴포넌트만 짠! 하고 소환해라! */}
      {activeStep === 0 && (
         {/* 💡 Props(프로퍼티): 가장 중요한 개념입니다! 
              부모(OrderPage)가 자식(ProductSelectionStep)에게 자기 메모리(cart, setCart)를 빌려주는 행위입니다. 
              자식은 이걸 받아서 그 안에다 장바구니를 채운 뒤 다시 부모 관제탑으로 돌려보냅니다! */}
        <ProductSelectionStep
          cart={cart}                 /* "내 장바구니 배열 빌려줄게" */
          onCartChange={setCart}      /* "장바구니 수정 리모콘도 빌려줄게" */
          discountRate={discountRate} /* "할인율 정보도 가져가" */
        />
      )}

      {/* 만약 지금 1번째 탭이라면? 고객 정보 입력 화면 컴포넌트만 짠! 소환! */}
      {activeStep === 1 && (
        <CustomerInfoStep
          customerInfo={customerInfo}
          setCustomerInfo={setCustomerInfo}
        />
      )}
      
      {/* ... 아래로 하단 바(총 액수 표시) 버튼 등으로 이어짐 ... */}
    </Box>
  );
};
