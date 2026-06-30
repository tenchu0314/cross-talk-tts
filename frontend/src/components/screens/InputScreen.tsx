/**
 * InputScreen.tsx — 議題入力画面
 *
 * ユーザーが討論のトピックと発話速度を入力するフォーム画面。
 * キャラクターのVSバナーも表示する。
 * topic と speed の状態はこのコンポーネント内でローカル管理する。
 */

import { useState } from 'react';
import { CHARACTER_IMAGES, SPEED_OPTIONS, DEFAULT_SPEED } from '../../constants';
import './InputScreen.css';

interface InputScreenProps {
  /** 討論開始コールバック（トピックと速度を渡す） */
  onStartDebate: (topic: string, speed: number) => void;
}

/** 議題入力画面コンポーネント */
export function InputScreen({ onStartDebate }: InputScreenProps) {
  /** 議題のテキスト */
  const [topic, setTopic] = useState('');
  /** 発話速度 */
  const [speed, setSpeed] = useState<number>(DEFAULT_SPEED);

  /** フォーム送信ハンドラ */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    onStartDebate(topic, speed);
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
          {/* クレア（左） */}
          <div className="vs-character claire">
            <img
              className="vs-avatar"
              src={CHARACTER_IMAGES.claire.default}
              alt="Claire"
            />
            <div className="vs-info-overlay">
              <div className="vs-name">🛡️ クレア</div>
              <div className="vs-role">Speaker 1: 論理的JK (データ重視)</div>
            </div>
          </div>

          {/* VS バッジ */}
          <div className="vs-divider-badge">
            <span className="vs-text">VS</span>
          </div>

          {/* カレン（右） */}
          <div className="vs-character karen">
            <img
              className="vs-avatar"
              src={CHARACTER_IMAGES.karen.default}
              alt="Karen"
            />
            <div className="vs-info-overlay">
              <div className="vs-name">🔥 カレン</div>
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

        {/* 開始ボタン */}
        <button
          className="start-button"
          type="submit"
          disabled={!topic.trim()}
        >
          討論台本を作成して開始
        </button>
      </form>
    </div>
  );
}
