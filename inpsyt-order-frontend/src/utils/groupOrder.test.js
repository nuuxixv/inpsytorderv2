import { describe, it, expect } from 'vitest';
import { classifyGroupStatusChange } from './groupOrder';

// 자식 3건 그룹: rep=1(대표), 2·3은 활성
const children = [
  { id: 1, status: 'paid' },
  { id: 2, status: 'paid' },
  { id: 3, status: 'pending' },
];
const repChildId = 1;

describe('classifyGroupStatusChange', () => {
  it('(a) 대표가 아니면 passthrough (취소여도)', () => {
    const child = children[1]; // id=2, 대표 아님
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'refunded' });
    expect(r.mode).toBe('passthrough');
  });

  it('(b) 취소/환불이 아니면 passthrough (대표여도)', () => {
    const child = children[0]; // id=1, 대표
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'paid' });
    expect(r.mode).toBe('passthrough');
  });

  it('(c) 대표 취소지만 남은 활성 형제 0건이면 passthrough', () => {
    const solo = [
      { id: 1, status: 'paid' },
      { id: 2, status: 'cancelled' },
      { id: 3, status: 'refunded' },
    ];
    const r = classifyGroupStatusChange({ children: solo, repChildId: 1, child: solo[0], newStatus: 'refunded' });
    expect(r.mode).toBe('passthrough');
  });

  it('(d) 대표 취소 + 남은 활성 형제 정확히 1건이면 auto (siblings=그 1건)', () => {
    const two = [
      { id: 1, status: 'paid' },
      { id: 2, status: 'paid' },
      { id: 3, status: 'cancelled' },
    ];
    const r = classifyGroupStatusChange({ children: two, repChildId: 1, child: two[0], newStatus: 'refunded' });
    expect(r.mode).toBe('auto');
    expect(r.siblings.map((s) => s.id)).toEqual([2]);
  });

  it('(e) 대표 취소 + 남은 활성 형제 2건+이면 pick (siblings=활성 형제 배열)', () => {
    const child = children[0]; // id=1, 대표, 남은 활성 2·3
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'cancelled' });
    expect(r.mode).toBe('pick');
    expect(r.siblings.map((s) => s.id)).toEqual([2, 3]);
  });

  it('활성 판정에서 자기 자신은 형제에서 제외', () => {
    const child = children[0];
    const r = classifyGroupStatusChange({ children, repChildId, child, newStatus: 'cancelled' });
    expect(r.siblings.some((s) => s.id === child.id)).toBe(false);
  });
});
