/**
 * GeneratingScreen.tsx — 討論生成中画面
 *
 * Gemini APIで討論台本を生成している間に表示する。
 * スピナー、説明テキスト、生成ログを表示する。
 */

import './GeneratingScreen.css';

interface GeneratingScreenProps {
  /** 生成ログの配列 */
  logs: string[];
}

/** 討論生成中画面コンポーネント */
export function GeneratingScreen({ logs }: GeneratingScreenProps) {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <h2 className="loading-title">討論生成中</h2>
      <p className="loading-step-desc">
        GeminiがWebサーチを使いながら説得力のある台本を作成しています...
      </p>

      {/* 生成ログ */}
      <div className="loading-logs-panel">
        {logs.map((log, idx) => (
          <div
            key={idx}
            className={`log-entry ${idx === logs.length - 1 ? 'active' : ''}`}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
