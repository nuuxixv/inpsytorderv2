import { Component } from 'react';

/**
 * 렌더 중 예외를 잡아 빈 화면 대신 안내를 띄운다.
 *
 * ErrorBoundary가 없으면 React가 트리 전체를 언마운트해 화면이 그대로 비고,
 * 사용자는 원인도 복구 방법도 알 수 없다. 현장에서 이건 주문 접수 중단이다.
 * (2026-07 오티즘 "화면이 비어버림" 계열 장애 대응)
 *
 * fallback은 MUI를 쓰지 않는다 — 테마·MUI 자체가 예외의 원인일 수 있으므로
 * 외부 의존 없이 그려져야 한다. index.html의 부트 폴백과 같은 스타일 언어.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 외부 수집처가 없으므로 콘솔에 남긴다. 현장에서 캡처를 받을 때 단서가 된다.
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          background: '#ffffff',
          color: '#111111',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>화면을 표시하지 못했습니다</p>
        <p style={{ margin: 0, fontSize: 14, color: '#666666', lineHeight: 1.6 }}>
          새로고침하면 대부분 해결됩니다.
          <br />
          같은 화면이 반복되면 담당자에게 알려주세요.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 600,
            color: '#ffffff',
            background: '#2B398F',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          새로고침
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
