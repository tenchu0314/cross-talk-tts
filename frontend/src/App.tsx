/**
 * App.tsx — アプリケーションルートコンポーネント
 *
 * 画面状態（screen）の管理と各画面コンポーネントの切り替えのみを担当する。
 * 討論再生のロジックは useDebatePlayer Hook に委譲し、
 * 各画面の表示は専用の画面コンポーネントに委譲する。
 */

import { useState, useEffect, useCallback } from 'react';
import type { ScreenType, SpeakerConfig } from './types';
import { useDebatePlayer } from './hooks/useDebatePlayer';
import { HealthCheckScreen } from './components/screens/HealthCheckScreen';
import { ConnectionErrorScreen } from './components/screens/ConnectionErrorScreen';
import { InputScreen } from './components/screens/InputScreen';
import { GeneratingScreen } from './components/screens/GeneratingScreen';
import { DebatePlayerScreen } from './components/screens/DebatePlayerScreen';
import './App.css';

export default function App() {
  /** 現在の画面状態 */
  const [screen, setScreen] = useState<ScreenType>('health-check');
  /** TTS接続エラーメッセージ */
  const [ttsHealthError, setTtsHealthError] = useState<string>('');
  /** 生成画面のログ */
  const [logs, setLogs] = useState<string[]>([]);
  /** スピーカー設定 */
  const [speakerConfig, setSpeakerConfig] = useState<SpeakerConfig>({
    speaker1Name: 'Speaker1',
    speaker2Name: 'Speaker2',
  });

  /** ログにメッセージを追加する */
  const addLog = useCallback((message: string) => {
    setLogs((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  }, []);

  /** 討論再生のカスタムHook */
  const player = useDebatePlayer({
    screen,
    onScreenChange: setScreen,
    addLog,
    speakerConfig,
  });

  // =========================================================================
  // TTSサーバーのヘルスチェック
  // =========================================================================

  /** TTSサーバーの接続状態を確認する */
  const checkTtsHealth = useCallback(async () => {
    setScreen('health-check');
    try {
      const res = await fetch('/api/tts/health');
      if (res.ok) {
        // Also fetch speaker config
        try {
          const configRes = await fetch('/api/config');
          if (configRes.ok) {
            const configData = await configRes.json();
            setSpeakerConfig(configData);
          }
        } catch (err) {
          console.error('Failed to load speaker configuration:', err);
        }
        setScreen('input');
        setTtsHealthError('');
      } else {
        const data = await res.json();
        setTtsHealthError(data.message || 'TTS Server not responding.');
        setScreen('connection-error');
      }
    } catch {
      setTtsHealthError(
        'Unable to connect to backend server or Irodori-TTS-Server.'
      );
      setScreen('connection-error');
    }
  }, []);

  /** 起動時にヘルスチェックを実行 */
  useEffect(() => {
    checkTtsHealth();
  }, [checkTtsHealth]);

  /** 討論開始時にログをリセットしてHookに委譲 */
  const handleStartDebate = useCallback(
    (topic: string, speed: number, isVideoRecordingMode: boolean) => {
      setLogs([]);
      player.startDebate(topic, speed, isVideoRecordingMode);
    },
    [player.startDebate]
  );

  // =========================================================================
  // 画面ルーティング
  // =========================================================================

  return (
    <div className="app-container">
      {screen === 'health-check' && <HealthCheckScreen />}

      {screen === 'connection-error' && (
        <ConnectionErrorScreen
          errorMessage={ttsHealthError}
          onRetry={checkTtsHealth}
        />
      )}

      {screen === 'input' && (
        <InputScreen onStartDebate={handleStartDebate} speakerConfig={speakerConfig} />
      )}

      {screen === 'generating' && <GeneratingScreen logs={logs} />}

      {screen === 'adv' && <DebatePlayerScreen {...player} />}
    </div>
  );
}
