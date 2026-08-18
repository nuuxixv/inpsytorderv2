// ErrorBoundary 회귀 테스트 — 렌더 예외 시 화면이 비지 않는지 실증.
// ErrorBoundary가 없던 시절에는 예외 하나로 트리가 언마운트되어 빈 화면이 됐고,
// 현장에서는 그게 주문 접수 중단이었다. 이 테스트는 그 상태로 되돌아가는 것을 막는다.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

const Boom = () => {
  throw new Error('의도적 예외');
};

describe('ErrorBoundary', () => {
  afterEach(() => vi.restoreAllMocks());

  it('자식이 정상이면 자식을 그대로 렌더한다', () => {
    render(
      <ErrorBoundary>
        <p>정상 화면</p>
      </ErrorBoundary>
    );
    expect(screen.getByText('정상 화면')).toBeInTheDocument();
  });

  it('자식이 예외를 던지면 빈 화면 대신 안내와 새로고침 버튼을 렌더한다', () => {
    // React가 잡힌 예외를 콘솔에 찍는 것 + componentDidCatch의 로그를 조용히 시킴
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('화면을 표시하지 못했습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '새로고침' })).toBeInTheDocument();
  });
});
