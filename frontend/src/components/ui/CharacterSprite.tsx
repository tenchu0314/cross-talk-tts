/**
 * CharacterSprite.tsx — キャラクター立ち絵コンポーネント
 *
 * 討論画面で左右に表示されるキャラクターの立ち絵。
 * アクティブ/非アクティブの切り替えアニメーション、
 * 画像読み込みエラー時のフォールバック表示を含む。
 */

import './CharacterSprite.css';

interface CharacterSpriteProps {
  /** キャラクター名（CSSクラスに使用） */
  character: 'speaker1' | 'speaker2';
  /** 現在発話中かどうか */
  isActive: boolean;
  /** 現在の感情（表示テキスト用） */
  emotion: string;
  /** 表示する画像パス */
  imageSrc: string;
  /** キャラクターの表示名 */
  displayName: string;
}

/** キャラクター立ち絵コンポーネント */
export function CharacterSprite({
  character,
  isActive,
  emotion,
  imageSrc,
  displayName,
}: CharacterSpriteProps) {
  return (
    <div
      className={`character-sprite-container ${character} ${isActive ? 'active' : 'inactive'}`}
    >
      {/* キャラクター画像 */}
      <img
        className="character-sprite"
        src={imageSrc}
        alt={displayName}
        onError={(e) => {
          // 画像が見つからない場合はフォールバックを表示
          e.currentTarget.style.display = 'none';
          const sibling = e.currentTarget.nextElementSibling as HTMLElement;
          if (sibling) sibling.style.display = 'flex';
        }}
      />
      {/* 画像読み込み失敗時のプレースホルダー */}
      <div className="character-placeholder" style={{ display: 'none' }}>
        <span className="character-placeholder-name">{displayName}</span>
        <span style={{ fontSize: '0.8rem' }}>
          {isActive ? `表情: ${emotion}` : '待機中'}
        </span>
      </div>
    </div>
  );
}
