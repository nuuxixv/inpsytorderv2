// prepNoteImages 순수 유닛 테스트 — 치환 양방향(서명URL↔경로) + 레거시 URL 파싱.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { createSignedUrlsMock } = vi.hoisted(() => ({ createSignedUrlsMock: vi.fn() }));

vi.mock('../supabaseClient', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrls: createSignedUrlsMock }) },
  },
}));

import {
  encodeForStorage, collectStoragePaths, applySignedUrls, resolveForDisplay, DISPLAY_TTL,
} from './prepNoteImages';

const BASE = 'https://qnrojyamcrvikbezkzwk.supabase.co/storage/v1/object/sign/event-images';
const signed = (path, token = 'eyJhbGciOiJIUzI1NiJ9.abc.def') => `${BASE}/${path}?token=${token}`;
const PATH_A = 'ev-1/1717990000000-a1b2c3.jpg';
const PATH_B = 'ev-1/1717990000001-x9y8z7.png';

describe('encodeForStorage (서명 URL → 경로 플레이스홀더)', () => {
  it('img src의 서명 URL을 storage:// 플레이스홀더로 치환', () => {
    const html = `<p>준비물</p><img src="${signed(PATH_A)}" alt="학회 자료">`;
    expect(encodeForStorage(html)).toBe(
      `<p>준비물</p><img src="storage://event-images/${PATH_A}" alt="학회 자료">`,
    );
  });

  it('여러 이미지 모두 치환', () => {
    const html = `<img src="${signed(PATH_A)}"><img src="${signed(PATH_B)}">`;
    expect(encodeForStorage(html)).toBe(
      `<img src="storage://event-images/${PATH_A}"><img src="storage://event-images/${PATH_B}">`,
    );
  });

  it('타 버킷·외부 URL·기존 플레이스홀더는 건드리지 않음', () => {
    const html = [
      '<img src="https://example.com/photo.jpg">',
      '<img src="https://x.supabase.co/storage/v1/object/sign/other-bucket/a.jpg?token=t">',
      `<img src="storage://event-images/${PATH_A}">`,
    ].join('');
    expect(encodeForStorage(html)).toBe(html);
  });

  it('빈 값 → 빈 문자열', () => {
    expect(encodeForStorage('')).toBe('');
    expect(encodeForStorage(null)).toBe('');
    expect(encodeForStorage(undefined)).toBe('');
  });
});

describe('collectStoragePaths (경로 수집 — 플레이스홀더 + 레거시 서명 URL)', () => {
  it('플레이스홀더에서 경로 추출', () => {
    const html = `<img src="storage://event-images/${PATH_A}">`;
    expect(collectStoragePaths(html)).toEqual([PATH_A]);
  });

  it('레거시 서명 URL에서 경로 추출 (토큰 제거)', () => {
    const html = `<img src="${signed(PATH_A)}">`;
    expect(collectStoragePaths(html)).toEqual([PATH_A]);
  });

  it('혼재 + 중복 제거', () => {
    const html = [
      `<img src="storage://event-images/${PATH_A}">`,
      `<img src="${signed(PATH_A)}">`,
      `<img src="${signed(PATH_B)}">`,
    ].join('');
    expect(collectStoragePaths(html)).toEqual([PATH_A, PATH_B]);
  });

  it('이미지 없으면 빈 배열', () => {
    expect(collectStoragePaths('<p>텍스트만</p>')).toEqual([]);
    expect(collectStoragePaths('')).toEqual([]);
  });
});

describe('applySignedUrls (경로 → 새 서명 URL)', () => {
  it('플레이스홀더를 새 서명 URL로 치환', () => {
    const fresh = signed(PATH_A, 'newToken');
    const html = `<img src="storage://event-images/${PATH_A}">`;
    expect(applySignedUrls(html, { [PATH_A]: fresh })).toBe(`<img src="${fresh}">`);
  });

  it('레거시(만료) 서명 URL도 새 URL로 치환', () => {
    const fresh = signed(PATH_A, 'newToken');
    const html = `<img src="${signed(PATH_A, 'expiredToken')}">`;
    expect(applySignedUrls(html, { [PATH_A]: fresh })).toBe(`<img src="${fresh}">`);
  });

  it('맵에 없는 경로(재서명 실패)는 원문 유지', () => {
    const html = `<img src="storage://event-images/${PATH_A}"><img src="storage://event-images/${PATH_B}">`;
    const fresh = signed(PATH_B, 'newToken');
    expect(applySignedUrls(html, { [PATH_B]: fresh })).toBe(
      `<img src="storage://event-images/${PATH_A}"><img src="${fresh}">`,
    );
  });
});

describe('왕복 (display → storage → display)', () => {
  it('encode 후 apply하면 새 토큰의 서명 URL로 복원', () => {
    const original = `<p>부스 배치도</p><img src="${signed(PATH_A, 'old')}" alt="학회 자료">`;
    const stored = encodeForStorage(original);
    const fresh = signed(PATH_A, 'fresh');
    expect(applySignedUrls(stored, { [PATH_A]: fresh })).toBe(
      `<p>부스 배치도</p><img src="${fresh}" alt="학회 자료">`,
    );
    expect(encodeForStorage(applySignedUrls(stored, { [PATH_A]: fresh }))).toBe(stored); // 재저장 안정
  });
});

describe('resolveForDisplay (배치 재서명)', () => {
  beforeEach(() => createSignedUrlsMock.mockReset());

  it('경로 없으면 storage 호출 없이 원문 반환', async () => {
    expect(await resolveForDisplay('<p>텍스트</p>')).toBe('<p>텍스트</p>');
    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it('플레이스홀더+레거시를 한 번의 배치 호출로 재서명·치환', async () => {
    const freshA = signed(PATH_A, 'freshA');
    const freshB = signed(PATH_B, 'freshB');
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: PATH_A, signedUrl: freshA, error: null },
        { path: PATH_B, signedUrl: freshB, error: null },
      ],
      error: null,
    });
    const html = `<img src="storage://event-images/${PATH_A}"><img src="${signed(PATH_B, 'old')}">`;
    expect(await resolveForDisplay(html)).toBe(`<img src="${freshA}"><img src="${freshB}">`);
    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock).toHaveBeenCalledWith([PATH_A, PATH_B], DISPLAY_TTL);
  });

  it('일부 실패 시 실패분만 원문 유지 (차단 없음)', async () => {
    const freshA = signed(PATH_A, 'freshA');
    createSignedUrlsMock.mockResolvedValue({
      data: [
        { path: PATH_A, signedUrl: freshA, error: null },
        { path: PATH_B, signedUrl: null, error: 'Object not found' },
      ],
      error: null,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = `<img src="storage://event-images/${PATH_A}"><img src="storage://event-images/${PATH_B}">`;
    expect(await resolveForDisplay(html)).toBe(
      `<img src="${freshA}"><img src="storage://event-images/${PATH_B}">`,
    );
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('호출 자체 실패(error 반환) 시 원문 반환 (차단 없음)', async () => {
    // storage-js는 실패를 reject 대신 { data: null, error }로 반환 — catch 경로 검증.
    // (spy가 직접 throw/reject하면 vitest spy 결과 기록이 unhandledRejection으로 잡혀 사용 불가)
    createSignedUrlsMock.mockResolvedValue({ data: null, error: new Error('network') });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = `<img src="storage://event-images/${PATH_A}">`;
    expect(await resolveForDisplay(html)).toBe(html);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('TTL은 1시간~24시간 사이(짧은 표시용)', () => {
    expect(DISPLAY_TTL).toBeGreaterThanOrEqual(60 * 60);
    expect(DISPLAY_TTL).toBeLessThanOrEqual(60 * 60 * 24);
  });
});
