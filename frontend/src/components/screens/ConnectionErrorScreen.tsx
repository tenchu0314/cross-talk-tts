/**
 * ConnectionErrorScreen.tsx — TTS接続エラー画面
 *
 * TTSサーバーへの接続に失敗した場合に表示する。
 * エラーメッセージと再接続ボタンを提供する。
 */

import './ConnectionErrorScreen.css';

interface ConnectionErrorScreenProps {
  /** エラーメッセージ */
  errorMessage: string;
  /** 再接続コールバック */
  onRetry: () => void;
}

/** TTS接続エラー画面コンポーネント */
export function ConnectionErrorScreen({
  errorMessage,
  onRetry,
}: ConnectionErrorScreenProps) {
  return (
    <div className="error-screen">
      <div className="error-icon">⚠️</div>
      <h2 className="error-title">TTS サーバー接続エラー</h2>
      <p className="error-message">{errorMessage}</p>
      <button className="retry-button" onClick={onRetry}>
        再接続を試行
      </button>
    </div>
  );
}
