/**
 * BufferingTitleOverlay.tsx — 動画撮影モード用のバッファリング画面（映画のタイトル風）
 *
 * 動画撮影モードのときのみ、バッファ中に画面全体を薄暗くし、
 * 中央に可変フォントサイズで討論のテーマを表示する。
 */

import './BufferingTitleOverlay.css';

interface BufferingTitleOverlayProps {
  /** 討論テーマ */
  debateTopic: string;
  /** フェードアウト中か */
  isFadeOut?: boolean;
}

export function BufferingTitleOverlay({ debateTopic, isFadeOut }: BufferingTitleOverlayProps) {
  return (
    <div className={`buffering-title-overlay ${isFadeOut ? 'fade-out' : ''}`}>
      <div className="title-card-container">
        {/* 上部の小さなラベル */}
        <span className="title-card-subtitle">DEBATE THEME</span>
        
        {/* メインの討論テーマ (可変フォントサイズ) */}
        <h1 className="title-card-main-title">{debateTopic}</h1>
        
        {/* 中央のパルスするアクセントライン */}
        <div className="title-card-accent-line"></div>
      </div>
    </div>
  );
}
