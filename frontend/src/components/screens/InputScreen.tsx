/**
 * InputScreen.tsx — 議題入力画面
 *
 * ユーザーが討論のトピックと発話速度を入力するフォーム画面。
 * キャラクターのVSバナーも表示する。
 * topic と speed の状態はこのコンポーネント内でローカル管理する。
 */

import { useState, useEffect } from 'react';
import { CHARACTER_IMAGES, SPEED_OPTIONS, DEFAULT_SPEED } from '../../constants';
import type { SpeakerConfig, DebateData, HistoryItem } from '../../types';
import './InputScreen.css';

interface InputScreenProps {
  /** 討論開始コールバック（トピックと速度、動画撮影モードフラグを渡す） */
  onStartDebate: (topic: string | DebateData, speed: number, isVideoRecordingMode: boolean) => void;
  /** スピーカー表示名設定 */
  speakerConfig: SpeakerConfig;
}

/** 議題入力画面コンポーネント */
export function InputScreen({ onStartDebate, speakerConfig }: InputScreenProps) {
  /** 議題のテキスト */
  const [topic, setTopic] = useState('');
  /** 発話速度 */
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);
  /** 動画撮影モード（UI非表示・GPU負荷軽減）にするか */
  const [isVideoRecordingMode, setIsVideoRecordingMode] = useState(false);
  /** 討論の履歴リスト */
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // マウント時に履歴をロード
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cross_talk_debate_history');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (err) {
      console.error('Failed to load debate history:', err);
    }
  }, []);

  /** フォーム送信ハンドラ */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onStartDebate(topic, speed, isVideoRecordingMode);
  };

  /** 履歴選択ハンドラ */
  const handleSelectHistory = (item: HistoryItem) => {
    onStartDebate(item.data, speed, isVideoRecordingMode);
  };

  /** 履歴削除ハンドラ */
  const handleDeleteHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter((item) => item.id !== id);
    setHistory(updated);
    try {
      localStorage.setItem('cross_talk_debate_history', JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  return (
    <div className="setup-screen">
      {/* ヘッダー */}
      <header className="app-header">
        <h1 className="app-title">Cross-Talk TTS</h1>
        <p className="app-subtitle">
          GeminiとローカルTTSによるキャラクター討論システム
        </p>
      </header>

      <form className="setup-form" onSubmit={handleSubmit}>
        {/* キャラクターVSバナー */}
        <div className="setup-vs-banner">
          {/* Speaker 1（左） */}
          <div className="vs-character speaker1">
            <img
              className="vs-avatar"
              src={CHARACTER_IMAGES.Speaker1.default}
              alt="Speaker 1"
            />
            <div className="vs-info-overlay">
              <div className="vs-name">🛡️ {speakerConfig.speaker1Name}</div>
              <div className="vs-role">Speaker 1: 論理的JK (データ重視)</div>
            </div>
          </div>

          {/* VS バッジ */}
          <div className="vs-divider-badge">
            <span className="vs-text">VS</span>
          </div>

          {/* Speaker 2（右） */}
          <div className="vs-character speaker2">
            <img
              className="vs-avatar"
              src={CHARACTER_IMAGES.Speaker2.default}
              alt="Speaker 2"
            />
            <div className="vs-info-overlay">
              <div className="vs-name">🔥 {speakerConfig.speaker2Name}</div>
              <div className="vs-role">Speaker 2: ギャル風JK (現場主義)</div>
            </div>
          </div>
        </div>

        {/* 議題入力フィールド */}
        <div className="form-group">
          <label className="form-label" htmlFor="topic-input">
            討論の議題を入力してください
          </label>
          <input
            id="topic-input"
            className="topic-input"
            type="text"
            placeholder="例: AIの発展は人類に幸福をもたらすか？"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
          />
        </div>

        {/* 速度選択 */}
        <div className="form-group">
          <label className="form-label" htmlFor="speed-select">
            発話速度
          </label>
          <select
            id="speed-select"
            className="speed-select"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {SPEED_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 動画撮影モードチェックボックス */}
        <label className="video-recording-mode-label" htmlFor="video-recording-mode-checkbox">
          <input
            id="video-recording-mode-checkbox"
            className="video-recording-mode-checkbox"
            type="checkbox"
            checked={isVideoRecordingMode}
            onChange={(e) => setIsVideoRecordingMode(e.target.checked)}
          />
          <span className="video-recording-mode-checkmark" />
          <span className="video-recording-mode-text">動画撮影モード</span>
        </label>

        {/* 開始ボタン */}
        <button
          className="start-button"
          type="submit"
          disabled={!topic.trim()}
        >
          討論台本を作成して開始
        </button>
      </form>

      {/* 過去の討論履歴 */}
      <div className="history-section">
        <h2 className="history-title">過去の討論履歴からリプレイ</h2>
        {history.length === 0 ? (
          <p className="no-history-text">再生に成功した討論の履歴はありません。</p>
        ) : (
          <div className="history-list">
            {history.map((item) => (
              <div
                key={item.id}
                className="history-item"
                onClick={() => handleSelectHistory(item)}
              >
                <div className="history-item-content">
                  <div className="history-item-topic">🗣️ {item.topic}</div>
                  <div className="history-item-meta">
                    <span>ターン数: {item.data.turns?.length || 0} ターン</span>
                    <span className="history-item-dot">•</span>
                    <span>
                      {new Date(item.timestamp).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <button
                  className="history-delete-button"
                  onClick={(e) => handleDeleteHistory(item.id, e)}
                  title="履歴から削除"
                  aria-label="履歴から削除"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
