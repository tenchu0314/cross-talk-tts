/**
 * DebateEndOverlay.tsx — 討論終了オーバーレイ
 *
 * 全ターンの再生が完了した後に表示される。
 * リプレイ・終了の選択肢を提供する。
 */

import './DebateEndOverlay.css';

interface DebateEndOverlayProps {
  /** 討論のトピック */
  topic: string;
  /** もう一度再生するコールバック */
  onReplay: () => void;
  /** 討論を終了するコールバック */
  onQuit: () => void;
}

/** 討論終了時のオーバーレイコンポーネント */
export function DebateEndOverlay({ topic, onReplay, onQuit }: DebateEndOverlayProps) {
  return (
    <div className="debate-end-overlay">
      <div className="debate-end-card">
        <div className="debate-end-icon">🎭</div>
        <h2 className="debate-end-title">討論終了</h2>
        <p className="debate-end-subtitle">{topic}</p>
        <div className="debate-end-actions">
          <button
            id="replay-debate-btn"
            className="replay-btn"
            onClick={onReplay}
          >
            🔄 もう一度聞く
          </button>
          <button
            id="quit-after-finish-btn"
            className="quit-after-finish-btn"
            onClick={onQuit}
          >
            ✕ 終了する
          </button>
        </div>
      </div>
    </div>
  );
}
