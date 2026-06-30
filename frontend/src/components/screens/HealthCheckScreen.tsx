/**
 * HealthCheckScreen.tsx — TTS接続確認画面
 *
 * アプリ起動時にTTSサーバーへの接続を確認している間に表示する。
 * スピナーとメッセージのみのシンプルな画面。
 */

import './HealthCheckScreen.css';

/** TTS接続確認画面コンポーネント */
export function HealthCheckScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner"></div>
      <h2 className="loading-title">TTS サーバー接続確認中</h2>
      <p className="loading-step-desc">
        Irodori-TTS-Serverへの接続を確認しています...
      </p>
    </div>
  );
}
