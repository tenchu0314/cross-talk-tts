/**
 * types.ts — 共通型定義
 *
 * アプリケーション全体で使用される型をここに集約する。
 * コンポーネントやカスタムHookがこのファイルからインポートして利用する。
 */

/** APIレスポンスに含まれる1ターン分のデータ */
export interface DebateTurn {
  speaker: 'Speaker1' | 'Speaker2';
  text: string;
  emotion: 'default' | 'serious' | 'angry';
}

/** DebateTurn に再生・TTS生成状態を追加したフロントエンド用の型 */
export interface TurnState extends DebateTurn {
  /** 生成された音声のBlob URL（未生成時はnull） */
  audioUrl: string | null;
  /** 音声の長さ（秒）。未取得時はnull */
  duration: number | null;
  /** ターンの現在の状態 */
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'played' | 'error';
  /** TTS生成にかかった時間（ミリ秒） */
  generationTimeMs?: number;
}

/** 討論生成APIのレスポンス型 */
export interface DebateData {
  topic: string;
  search_queries?: string[];
  turns: DebateTurn[];
}

/** アプリの画面状態 */
export type ScreenType =
  | 'health-check'
  | 'input'
  | 'generating'
  | 'adv'
  | 'connection-error';

/** バッファリング状態 */
export interface BufferState {
  /** 再生を開始できるか */
  canPlay: boolean;
  /** 表示用メッセージ */
  msg: string;
}
