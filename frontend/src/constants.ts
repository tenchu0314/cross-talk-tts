/**
 * constants.ts — アプリケーション定数
 *
 * 画像パス、設定値、選択肢など、アプリ全体で使用される定数を管理する。
 * ハードコードされた値をここに集約することで、変更時の影響範囲を最小化する。
 */

/** キャラクター画像パス */
export const CHARACTER_IMAGES = {
  Speaker1: {
    default: '/assets/speaker1_default.png',
    serious: '/assets/speaker1_serious.png',
    angry: '/assets/speaker1_angry.png',
  },
  Speaker2: {
    default: '/assets/speaker2_default.png',
    serious: '/assets/speaker2_serious.png',
    angry: '/assets/speaker2_angry.png',
  },
} as const;

/** 討論画面の背景画像パス */
export const DEBATE_BG = '/assets/debate_bg.png';

/** 発話速度の選択肢 */
export const SPEED_OPTIONS = [
  { value: 0.8, label: '0.8x (遅め)' },
  { value: 1.0, label: '1.0x (標準)' },
  { value: 1.3, label: '1.3x (おすすめ - 早め)' },
  { value: 1.5, label: '1.5x (高速)' },
  { value: 1.8, label: '1.8x (超高速)' },
] as const;

/** デフォルトの発話速度 */
export const DEFAULT_SPEED = 1.3;

/** TTS同時リクエスト上限 */
export const MAX_CONCURRENT_REQUESTS = 2;

/** 音声読み込みタイムアウト（ミリ秒） */
export const AUDIO_LOAD_TIMEOUT_MS = 5000;

/** 平均生成速度の初期推定値（秒/文字）— 実測値が出るまでの仮値 */
export const DEFAULT_ESTIMATED_SPEED = 0.15;

/** バッファ安全マージン倍率 */
export const BUFFER_SAFETY_MARGIN = 1.1;

/** 再生開始に必要な最小バッファ済みターン数（平均速度未算出時） */
export const MIN_BUFFER_TURNS = 2;

/** 再生開始の代替条件: 準備済みターンの割合（%） */
export const BUFFER_PERCENT_THRESHOLD = 50;
