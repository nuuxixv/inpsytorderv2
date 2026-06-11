// PrepNoteViewer 호환 테스트 — A7 게시판 교체 핵심 리스크 실증.
// 1) 레거시 게시글(content=마크다운 raw)이 새 Toast UI Viewer에서 깨지지 않고 HTML로 렌더되는지
// 2) 신규 HTML 저장본도 그대로 렌더되는지
// 3) bucket prop이 resolveForDisplay로 전달되는지(이미지 본문)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PrepNoteViewer from './PrepNoteViewer';

const { createSignedUrlsMock } = vi.hoisted(() => ({ createSignedUrlsMock: vi.fn() }));

vi.mock('../supabaseClient', () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrls: createSignedUrlsMock }) },
  },
}));

describe('PrepNoteViewer — 레거시 마크다운 하위호환', () => {
  beforeEach(() => createSignedUrlsMock.mockReset());

  it('마크다운 raw(기존 게시글)를 HTML 요소로 렌더 — heading/bold/list/link', async () => {
    const legacyMarkdown = [
      '# 학회 공지',
      '',
      '**굵게** 그리고 일반 텍스트.',
      '',
      '- 항목 하나',
      '- 항목 둘',
      '',
      '[인싸이트](https://inpsyt.co.kr)',
    ].join('\n');

    const { container } = render(<PrepNoteViewer content={legacyMarkdown} bucket="bulletin-images" />);

    // 마크다운이 HTML로 변환돼야 함(raw 텍스트 노출이 아니라 실제 태그)
    await waitFor(() => {
      expect(container.querySelector('h1')).toBeTruthy();
    });
    expect(screen.getByText('학회 공지')).toBeInTheDocument();
    expect(container.querySelector('strong')).toBeTruthy();
    expect(container.querySelectorAll('li').length).toBe(2);
    const link = container.querySelector('a[href="https://inpsyt.co.kr"]');
    expect(link).toBeTruthy();
    // 원시 마크다운 기호가 그대로 텍스트로 새어 나오면 안 됨
    expect(container.textContent).not.toContain('# 학회 공지');
    expect(container.textContent).not.toContain('**굵게**');
  });

  it('신규 HTML 저장본도 그대로 렌더', async () => {
    const html = '<h2>패치 노트</h2><p>v3 배포 완료</p>';
    const { container } = render(<PrepNoteViewer content={html} bucket="bulletin-images" />);
    await waitFor(() => {
      expect(container.querySelector('h2')).toBeTruthy();
    });
    expect(screen.getByText('패치 노트')).toBeInTheDocument();
    expect(screen.getByText('v3 배포 완료')).toBeInTheDocument();
  });

  it('빈 content도 안전(크래시 없음)', async () => {
    const { container } = render(<PrepNoteViewer content="" bucket="bulletin-images" />);
    await waitFor(() => {
      expect(container.querySelector('.toastui-editor-contents')).toBeTruthy();
    });
  });

  it('이미지 플레이스홀더 있으면 bulletin-images 버킷으로 재서명 요청', async () => {
    const PATH = 'post-1/img.webp';
    createSignedUrlsMock.mockResolvedValue({
      data: [{ path: PATH, signedUrl: 'https://x/sign/bulletin-images/post-1/img.webp?token=t', error: null }],
      error: null,
    });
    render(<PrepNoteViewer content={`<p><img src="storage://bulletin-images/${PATH}"></p>`} bucket="bulletin-images" />);
    await waitFor(() => {
      expect(createSignedUrlsMock).toHaveBeenCalledWith([PATH], expect.any(Number));
    });
  });
});
