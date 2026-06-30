/**
 * ProgressTrack.tsx — ターン進捗バー
 *
 * 各ターンのTTS生成/再生状態を色付きノードで視覚化する。
 * 全体の進捗もテキストで表示する。
 */

import type { TurnState } from '../../types';
import './ProgressTrack.css';

interface ProgressTrackProps {
  /** 全ターンの状態配列 */
  turns: TurnState[];
  /** 現在再生中のターンインデックス */
  currentIndex: number;
  /** 再生中かどうか */
  isPlaying: boolean;
  /** バッファリング中かどうか */
  isBuffering: boolean;
}

/** ターン進捗バーコンポーネント */
export function ProgressTrack({
  turns,
  currentIndex,
  isPlaying,
  isBuffering,
}: ProgressTrackProps) {
  // 生成完了済みのターン数を計算
  const completedCount = turns.filter(
    (t) => t.status === 'ready' || t.status === 'played' || t.status === 'playing'
  ).length;

  return (
    <div className="debate-progress-stats">
      {/* 進捗ノード */}
      <div className="progress-track-wrapper">
        {turns.map((t, idx) => (
          <div
            key={idx}
            className={`progress-node ${
              idx === currentIndex && isPlaying && !isBuffering
                ? 'playing'
                : t.status
            }`}
            title={`ターン ${idx + 1}: ${t.status}`}
          />
        ))}
      </div>
      {/* 進捗テキスト */}
      <span className="stats-text">
        {turns.length > 0
          ? `進捗: ${completedCount}/${turns.length} 生成完了`
          : ''}
      </span>
    </div>
  );
}
