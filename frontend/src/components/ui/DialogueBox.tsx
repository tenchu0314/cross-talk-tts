/**
 * DialogueBox.tsx — セリフ表示ボックス
 *
 * 現在のターンのセリフテキスト、スピーカー名バッジ、
 * および子要素として渡されるフッター（操作・メタ情報・進捗）を表示する。
 */

import type { TurnState } from '../../types';
import './DialogueBox.css';

interface DialogueBoxProps {
  /** 現在のターン情報（nullは再生前） */
  currentTurn: TurnState | null;
  /** フッター部分のchildren */
  children: React.ReactNode;
}

/** セリフ表示ボックスコンポーネント */
export function DialogueBox({ currentTurn, children }: DialogueBoxProps) {
  return (
    <div className="dialogue-window-container">
      <div className="dialogue-box">
        {/* スピーカー名バッジ */}
        {currentTurn && (
          <div
            className={`speaker-name-badge ${currentTurn.speaker === 'Speaker1' ? 'claire' : 'karen'}`}
          >
            {currentTurn.speaker === 'Speaker1' ? 'クレア' : 'カレン'}
          </div>
        )}

        {/* セリフテキスト */}
        <div className="dialogue-text">
          {currentTurn ? currentTurn.text : '討論の開始を待っています...'}
        </div>

        {/* フッター: 操作ボタン・メタ情報・進捗バー */}
        {children}
      </div>
    </div>
  );
}
