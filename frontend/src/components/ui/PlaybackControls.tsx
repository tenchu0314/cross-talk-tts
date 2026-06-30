/**
 * PlaybackControls.tsx — 再生操作ボタン群
 *
 * 「前へ」「再生/一時停止」「次へ」のボタンを提供する。
 */

import './PlaybackControls.css';

interface PlaybackControlsProps {
  /** 再生中かどうか */
  isPlaying: boolean;
  /** 再生可能かどうか */
  canPlay: boolean;
  /** 現在のターンインデックス */
  currentIndex: number;
  /** 全ターン数 */
  totalTurns: number;
  /** 再生/一時停止コールバック */
  onPlayPause: () => void;
  /** 次へスキップコールバック */
  onSkipForward: () => void;
  /** 前へ戻るコールバック */
  onSkipBackward: () => void;
}

/** 再生操作ボタン群コンポーネント */
export function PlaybackControls({
  isPlaying,
  canPlay,
  currentIndex,
  totalTurns,
  onPlayPause,
  onSkipForward,
  onSkipBackward,
}: PlaybackControlsProps) {
  return (
    <div className="playback-controls">
      {/* 前のターンへ戻るボタン */}
      <button
        className="control-btn"
        onClick={onSkipBackward}
        disabled={currentIndex <= 0}
      >
        ◀ 前へ
      </button>

      {/* 再生/一時停止ボタン */}
      <button
        className="control-btn primary"
        onClick={onPlayPause}
        disabled={currentIndex === -1 && !canPlay}
      >
        {isPlaying ? '⏸ 一時停止' : '▶ 再生'}
      </button>

      {/* 次のターンへスキップボタン */}
      <button
        className="control-btn"
        onClick={onSkipForward}
        disabled={currentIndex === -1 || currentIndex >= totalTurns - 1}
      >
        次へ ▶
      </button>
    </div>
  );
}
