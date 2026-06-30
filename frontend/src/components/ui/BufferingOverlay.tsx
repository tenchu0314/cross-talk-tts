/**
 * BufferingOverlay.tsx — バッファリングオーバーレイ
 *
 * 音声が生成中でまだ再生できない場合に表示するオーバーレイ。
 * スピナーとメッセージを表示する。
 */

import './BufferingOverlay.css';

interface BufferingOverlayProps {
  /** 表示するメッセージ */
  message: string;
}

/** バッファリング中の待機表示コンポーネント */
export function BufferingOverlay({ message }: BufferingOverlayProps) {
  return (
    <div className="buffering-overlay">
      <div className="buffering-spinner"></div>
      <div className="buffering-text">{message}</div>
    </div>
  );
}
