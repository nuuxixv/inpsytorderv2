// 출고 엑셀 빌드 — 주문관리·출고관리 공유 단일 소스.
// OrderManagementPage.handleExcelDownload에서 추출. 컬럼 순서·필터·파일명 규칙은 현행 유지.
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { STATUS_TO_KOREAN } from '../constants/orderStatus';
import { formatPhone } from './formatPhone';

// type별 아이템 필터: book=도서, test=검사 계열, all=전체(분류 없고 상품정보도 없으면 제외)
const matchesType = (itemCategory, type, hasProduct) => {
  if (!itemCategory && !hasProduct) return false;
  if (type === 'book') return itemCategory === '도서';
  if (type === 'test') return itemCategory?.includes('검사') || itemCategory === '온라인검사';
  return true;
};

/**
 * 주문 목록을 엑셀 행 배열로 변환한다 (아이템 단위 분해).
 * 아이템 소스 = order.mergedItems || order.order_items (합배송 껍데기는 mergedItems).
 * @param {{orders:Array, type:'book'|'test'|'all', events:Array, productsMap:object, eventFilterName:(string|null)}}
 * @returns {Array<object>}
 */
export const buildOrderExcelRows = ({ orders, type, events = [], productsMap = {}, eventFilterName }) => {
  const rows = [];
  const isFilteredByEvent = Boolean(eventFilterName);

  (orders || []).forEach((order) => {
    const orderEvent = events.find((e) => e.id === order.event_id)?.name || 'N/A';
    const itemsToExport = (order.mergedItems || order.order_items || []).filter((item) => {
      const itemCategory = item.category || productsMap[item.product_id]?.category || item.products?.category;
      const hasProduct = Boolean(productsMap[item.product_id] || item.products);
      return matchesType(itemCategory, type, hasProduct);
    });

    if (itemsToExport.length === 0) return;

    itemsToExport.forEach((item) => {
      const product = productsMap[item.product_id];
      const row = {
        '주문일시': format(new Date(order.created_at), 'yyyy-MM-dd HH:mm'),
        '주문번호': order.id,
        '고객명': order.customer_name,
        '연락처': formatPhone(order.phone_number),
        '배송 주소': `${order.shipping_address?.postcode || ''} ${order.shipping_address?.address || ''} ${order.shipping_address?.detail || ''}`.trim(),
        '고객 요청사항': order.customer_request || '-',
        '관리자 메모': order.admin_memo || '-',
      };

      if (!isFilteredByEvent) {
        row['학회명'] = orderEvent;
      }

      row['카테고리'] = item.category || product?.category || item.products?.category || 'N/A';
      row['상품명'] = item.product_name || product?.name || item.products?.name || 'N/A';
      row['주문 수량'] = item.quantity;
      row['실결제금액(참고)'] = order.final_payment;
      row['상태'] = STATUS_TO_KOREAN[order.status] || order.status;

      rows.push(row);
    });
  });

  return rows;
};

/**
 * 엑셀 파일을 생성·다운로드한다. 행이 없으면 파일을 만들지 않고 rowCount=0 반환.
 * @returns {{ rowCount:number, fileName:(string|null) }}
 */
export const exportOrderExcel = ({ orders, type, events, productsMap, eventFilterName }) => {
  const rows = buildOrderExcelRows({ orders, type, events, productsMap, eventFilterName });
  if (rows.length === 0) return { rowCount: 0, fileName: null };

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '출고목록');

  const dateStr = format(new Date(), 'yyyyMMdd');
  const eventPrefix = eventFilterName ? `[${eventFilterName}]_` : '';
  const typeStr = type === 'book' ? '도서출고목록' : type === 'test' ? '검사출고목록' : '통합주문목록';
  const fileName = `${eventPrefix}${typeStr}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, fileName);
  return { rowCount: rows.length, fileName };
};
