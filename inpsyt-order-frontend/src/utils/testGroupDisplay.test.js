import { describe, it, expect } from 'vitest';
import { normalizeCategory, buildGroupMetaMap, groupTestProducts } from './testGroupDisplay';

const master = [
  { id: 1, abbr: 'K·BASC-3', name: '한국판 정서-행동 평가시스템', sort_order: 1, is_active: true },
  { id: 2, abbr: 'CIBT', name: '인지행동치료 프로그램', sort_order: 2, is_active: true },
  { id: 9, abbr: 'K-WAIS-IV', name: '한국판 웩슬러 성인 지능검사', sort_order: 3, is_active: false }, // 숨김
];

const products = [
  // 검사군 1 — 옵션 3개(정렬 검증: sort_order 2,1,null)
  { id: 101, category: '검사', test_group_id: 1, option_name: 'B', sort_order: 2, is_popular: true },
  { id: 102, category: '검사', test_group_id: 1, option_name: 'A', sort_order: 1 },
  { id: 103, category: '검사', test_group_id: 1, option_name: 'C', sort_order: null },
  // 검사군 2 — 옵션 1개(도구 카테고리, 검사로 정규화)
  { id: 201, category: '도구', test_group_id: 2, option_name: '단일', sort_order: 1 },
  // 검사군 9 — 숨김(마스터 is_active=false) → 제외
  { id: 901, category: '검사', test_group_id: 9, option_name: 'X', sort_order: 1 },
  // 미분류 검사(test_group_id 없음) → 그룹 제외(평면)
  { id: 301, category: '검사', test_group_id: null, name: '미분류 검사' },
  // 도서(평면)
  { id: 401, category: '도서', name: '도서A' },
];

describe('normalizeCategory', () => {
  it('도구를 검사로 정규화', () => {
    expect(normalizeCategory('도구')).toBe('검사');
    expect(normalizeCategory('검사')).toBe('검사');
    expect(normalizeCategory('도서')).toBe('도서');
  });
});

describe('buildGroupMetaMap', () => {
  it('is_active=false 검사군은 제외', () => {
    const m = buildGroupMetaMap(master);
    expect(m.has(1)).toBe(true);
    expect(m.has(2)).toBe(true);
    expect(m.has(9)).toBe(false);
  });
  it('빈/undefined 마스터는 빈 맵', () => {
    expect(buildGroupMetaMap([]).size).toBe(0);
    expect(buildGroupMetaMap(undefined).size).toBe(0);
  });
});

describe('groupTestProducts', () => {
  const meta = buildGroupMetaMap(master);

  it('검사군으로 그룹핑하고 마스터 메타(약어·검사명) 병합', () => {
    const groups = groupTestProducts(products, meta, true);
    const ids = groups.map(g => g.id);
    expect(ids).toEqual([1, 2]); // 9=숨김 제외, sort_order 순
    expect(groups[0].abbr).toBe('K·BASC-3');
    expect(groups[0].name).toBe('한국판 정서-행동 평가시스템');
  });

  it('숨김 검사군(마스터 is_active=false) 제외', () => {
    const groups = groupTestProducts(products, meta, true);
    expect(groups.find(g => g.id === 9)).toBeUndefined();
  });

  it('미분류(test_group_id null)·도서는 그룹에 안 들어감(평면 대상)', () => {
    const groups = groupTestProducts(products, meta, true);
    const grouped = groups.flatMap(g => g.options.map(o => o.id));
    expect(grouped).not.toContain(301);
    expect(grouped).not.toContain(401);
  });

  it('옵션 정렬: sort_order ASC, NULL은 뒤로(원본순 안정)', () => {
    const groups = groupTestProducts(products, meta, true);
    const g1 = groups.find(g => g.id === 1);
    expect(g1.options.map(o => o.id)).toEqual([102, 101, 103]); // sort 1,2,null
  });

  it('옵션 1개 검사군도 정상 그룹핑(도구→검사 정규화)', () => {
    const groups = groupTestProducts(products, meta, true);
    const g2 = groups.find(g => g.id === 2);
    expect(g2.options).toHaveLength(1);
    expect(g2.options[0].id).toBe(201);
  });

  it('graceful: 마스터 없으면 메타 폴백(상품명·정렬 0)으로 그룹 유지', () => {
    const groups = groupTestProducts(products, new Map(), false);
    // 마스터 없음(hasMaster=false) → 숨김 판정 불가, test_group_id 있는 검사 전부 그룹(9 포함)
    const ids = groups.map(g => g.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 9]);
    const g1 = groups.find(g => g.id === 1);
    expect(g1.abbr).toBeNull();
    expect(g1.sort_order).toBe(0); // 마스터 없으면 정렬 폴백 0
  });

  it('빈 상품 배열은 빈 그룹', () => {
    expect(groupTestProducts([], meta, true)).toEqual([]);
  });
});
