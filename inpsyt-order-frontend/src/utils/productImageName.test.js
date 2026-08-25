import { describe, it, expect } from 'vitest';
import {
  buildProductImageFilename,
  getSafeImageExtension,
  IMAGE_EXT_WHITELIST,
} from './productImageName';

// 컴포넌트의 SAFE_IMAGE_FILENAME과 동일 — 결과가 이 정규식을 반드시 통과해야 한다(Storage 키 안전).
const SAFE_IMAGE_FILENAME = /^[A-Za-z0-9._-]+$/;

describe('getSafeImageExtension', () => {
  it('확장자를 소문자로 보존한다', () => {
    expect(getSafeImageExtension('사진.JPG')).toBe('jpg');
    expect(getSafeImageExtension('photo.PNG')).toBe('png');
    expect(getSafeImageExtension('a.WebP')).toBe('webp');
  });

  it('여러 점이 있어도 마지막 확장자만 본다', () => {
    expect(getSafeImageExtension('검사.표지.v2.jpeg')).toBe('jpeg');
  });

  it('화이트리스트 밖 확장자는 null', () => {
    expect(getSafeImageExtension('doc.bmp')).toBeNull();
    expect(getSafeImageExtension('icon.svg')).toBeNull();
    expect(getSafeImageExtension('photo.heic')).toBeNull();
    expect(getSafeImageExtension('scan.pdf')).toBeNull();
  });

  it('확장자 없음·빈값·끝점은 null', () => {
    expect(getSafeImageExtension('확장자없는파일')).toBeNull();
    expect(getSafeImageExtension('')).toBeNull();
    expect(getSafeImageExtension(null)).toBeNull();
    expect(getSafeImageExtension('trailingdot.')).toBeNull();
  });
});

describe('buildProductImageFilename', () => {
  const now = 1724500000000;

  it('한글 원본 파일명도 안전명으로 생성(거부하지 않음)', () => {
    const name = buildProductImageFilename({ originalName: '지능검사 표지.jpg', productCode: 'K-WISC-V', now });
    expect(name).toBe('pK-WISC-V-1724500000000.jpg');
    expect(SAFE_IMAGE_FILENAME.test(name)).toBe(true);
  });

  it('공백·특수문자 상품코드도 안전 조각으로 정리', () => {
    const name = buildProductImageFilename({ originalName: 'a.png', productCode: '심리검사 01!', now });
    expect(SAFE_IMAGE_FILENAME.test(name)).toBe(true);
    expect(name.endsWith('.png')).toBe(true);
  });

  it('확장자를 보존하고 소문자화', () => {
    expect(buildProductImageFilename({ originalName: 'x.JPEG', productCode: 'A1', now }))
      .toBe('pA1-1724500000000.jpeg');
  });

  it('상품코드가 비면 productId로 폴백', () => {
    const name = buildProductImageFilename({ originalName: 'x.webp', productCode: '', productId: 1234, now });
    expect(name).toBe('p1234-1724500000000.webp');
  });

  it('상품코드·ID 모두 없으면 item으로 폴백', () => {
    const name = buildProductImageFilename({ originalName: 'x.gif', now });
    expect(name).toBe('pitem-1724500000000.gif');
    expect(SAFE_IMAGE_FILENAME.test(name)).toBe(true);
  });

  it('지원하지 않는 확장자는 null 반환(거부)', () => {
    expect(buildProductImageFilename({ originalName: 'photo.heic', productCode: 'A1', now })).toBeNull();
    expect(buildProductImageFilename({ originalName: '확장자없음', productCode: 'A1', now })).toBeNull();
  });

  it('화이트리스트는 jpg/jpeg/png/webp/gif', () => {
    expect(IMAGE_EXT_WHITELIST).toEqual(['jpg', 'jpeg', 'png', 'webp', 'gif']);
  });
});
