/**
 * DialogueBox.tsx — セリフ表示ボックス
 *
 * 現在のターンのセリフテキスト、スピーカー名バッジ、
 * および子要素として渡されるフッター（操作・メタ情報・進捗）を表示する。
 */

import type { TurnState, SpeakerConfig } from '../../types';
import './DialogueBox.css';

interface DialogueBoxProps {
  /** 現在のターン情報（nullは再生前） */
  currentTurn: TurnState | null;
  /** フッター部分のchildren */
  children: React.ReactNode;
  /** スピーカー表示名設定 */
  speakerConfig: SpeakerConfig;
}

/** セリフ表示ボックスコンポーネント */
export function DialogueBox({ currentTurn, children, speakerConfig }: DialogueBoxProps) {
  return (
    <div className="dialogue-window-container">
      <div className="dialogue-box">
        {/* スピーカー名バッジ */}
        {currentTurn && (
          <div
            className={`speaker-name-badge ${currentTurn.speaker === 'Speaker1' ? 'speaker1' : 'speaker2'}`}
          >
            {currentTurn.speaker === 'Speaker1' ? speakerConfig.speaker1Name : speakerConfig.speaker2Name}
          </div>
        )}

        {/* セリフテキスト */}
        <div className="dialogue-text">
          {currentTurn ? currentTurn.text : ''}
        </div>

        {/* フッター: 操作ボタン・メタ情報・進捗バー */}
        {children}
      </div>
    </div>
  );
}
