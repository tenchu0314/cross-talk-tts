/**
 * useDebatePlayer.ts — 討論再生のカスタムHook
 *
 * TTS音声キュー管理、音声再生制御、バッファリング判定、再生操作など
 * 討論プレイヤーに関する全ロジックをこのHookに集約する。
 * 画面コンポーネントにはUIのみを残し、関心の分離を実現する。
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TurnState, DebateData, ScreenType, BufferState, SpeakerConfig } from '../types';
import {
  MAX_CONCURRENT_REQUESTS,
  AUDIO_LOAD_TIMEOUT_MS,
  DEFAULT_ESTIMATED_SPEED,
  BUFFER_SAFETY_MARGIN,
  MIN_BUFFER_TURNS,
  BUFFER_PERCENT_THRESHOLD,
  CHARACTER_IMAGES,
} from '../constants';

/** Hookの引数 */
interface UseDebatePlayerArgs {
  /** 現在の画面状態 */
  screen: ScreenType;
  /** 画面遷移コールバック */
  onScreenChange: (screen: ScreenType) => void;
  /** ログ追加コールバック（生成画面のログ表示用） */
  addLog: (message: string) => void;
  /** スピーカー表示名設定 */
  speakerConfig: SpeakerConfig;
}

/** Hookの返り値の型 */
export interface DebatePlayerState {
  // --- 状態 ---
  /** 全ターンの状態配列 */
  turns: TurnState[];
  /** 現在再生中のターンのインデックス（-1は再生前） */
  currentIndex: number;
  /** 再生中かどうか */
  isPlaying: boolean;
  /** バッファリング中（音声生成待ち）かどうか */
  isBuffering: boolean;
  /** 討論が終了したかどうか */
  isDebateFinished: boolean;
  /** 討論のトピック */
  debateTopic: string;
  /** Web検索クエリ */
  searchQueries: string[];
  /** バッファ状態（再生可能か、メッセージ） */
  bufferState: BufferState;
  /** スピーカー表示名設定 */
  speakerConfig: SpeakerConfig;

  // --- 現在のターン情報（派生値） ---
  /** 現在のターンオブジェクト（nullは再生前） */
  currentTurn: TurnState | null;
  /** 現在発話中のスピーカー */
  activeSpeaker: 'Speaker1' | 'Speaker2' | null;
  /** 現在の感情 */
  currentEmotion: 'default' | 'serious' | 'angry';

  // --- 操作関数 ---
  /** 討論を開始する */
  startDebate: (topic: string, speed: number) => Promise<void>;
  /** 再生/一時停止を切り替える */
  handlePlayPause: () => void;
  /** 次のターンへスキップ */
  handleSkipForward: () => void;
  /** 前のターンへ戻る */
  handleSkipBackward: () => void;
  /** 討論を終了してトップに戻る */
  handleQuitDebate: () => void;
  /** 討論をもう一度最初から再生する */
  handleReplayDebate: () => void;
  /** キャラクター画像のパスを取得する */
  getSpeaker1Img: () => string;
  /** キャラクター画像のパスを取得する */
  getSpeaker2Img: () => string;
}

/**
 * 討論再生に必要な全ロジックを提供するカスタムHook
 */
export function useDebatePlayer({
  screen,
  onScreenChange,
  addLog,
  speakerConfig,
}: UseDebatePlayerArgs): DebatePlayerState {
  // =========================================================================
  // 状態管理
  // =========================================================================

  /** 討論トピック */
  const [debateTopic, setDebateTopic] = useState('');
  /** Web検索クエリ一覧 */
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  /** 全ターンの状態 */
  const [turns, setTurns] = useState<TurnState[]>([]);
  /** 現在再生中のターンインデックス（-1 = 再生前） */
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  /** 再生中フラグ */
  const [isPlaying, setIsPlaying] = useState(false);
  /** バッファリング中フラグ */
  const [isBuffering, setIsBuffering] = useState(false);
  /** 討論終了フラグ */
  const [isDebateFinished, setIsDebateFinished] = useState(false);
  /** 平均TTS生成速度（秒/文字） */
  const [averageSpeed, setAverageSpeed] = useState<number | null>(null);
  /** 発話速度 */
  const [speed, setSpeed] = useState<number>(1.3);

  // =========================================================================
  // Ref（非同期処理のクロージャ問題を避けるための参照）
  // =========================================================================

  /** 音声再生用のAudioオブジェクト */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** ターンの最新状態への参照 */
  const turnsRef = useRef<TurnState[]>([]);
  /** 現在のインデックスへの参照 */
  const currentIndexRef = useRef<number>(-1);
  /** 再生中フラグへの参照 */
  const isPlayingRef = useRef<boolean>(false);
  /** アクティブなTTSリクエスト数 */
  const activeRequestsRef = useRef<number>(0);
  /** TTS処理待ちのインデックスキュー */
  const requestQueueRef = useRef<number[]>([]);
  /** セッションID（新しい討論開始時に更新、前回のリクエストをキャンセルするため） */
  const debateSessionRef = useRef<number>(0);

  // =========================================================================
  // Refの同期（stateが変わるたびにrefも更新）
  // =========================================================================

  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // =========================================================================
  // TTS生成キュー管理
  // =========================================================================

  /**
   * TTSキューを開始する
   * 全ターンをキューに入れ、同時リクエスト数の上限まで処理を開始する
   */
  const startTtsQueue = useCallback((initialTurns: TurnState[], sessionId: number) => {
    activeRequestsRef.current = 0;
    requestQueueRef.current = initialTurns.map((_, index) => index);
    processNextTtsRequests(sessionId);
  }, []);

  /**
   * 次のTTSリクエストを処理する
   * 同時リクエスト上限に達するまでキューからリクエストを取り出して実行する
   */
  const processNextTtsRequests = useCallback((sessionId: number) => {
    if (debateSessionRef.current !== sessionId) return;
    while (
      activeRequestsRef.current < MAX_CONCURRENT_REQUESTS &&
      requestQueueRef.current.length > 0
    ) {
      const nextIndex = requestQueueRef.current.shift();
      if (nextIndex !== undefined) {
        fetchTtsForTurn(nextIndex, sessionId);
      }
    }
  }, []);

  /**
   * 個別ターンのTTS音声を取得する
   * APIコール → Blob URL生成 → 音声長さ取得 → ターン状態更新
   */
  const fetchTtsForTurn = useCallback(async (index: number, sessionId: number) => {
    activeRequestsRef.current++;

    // セッションが変わっていたら中止
    if (debateSessionRef.current !== sessionId) {
      activeRequestsRef.current--;
      return;
    }

    // ターン状態を「生成中」に更新
    setTurns((prev) => {
      if (debateSessionRef.current !== sessionId) return prev;
      const updated = [...prev];
      if (updated[index]) updated[index].status = 'loading';
      return updated;
    });

    const startTime = performance.now();
    const turnText = turnsRef.current[index]?.text;
    const speaker = turnsRef.current[index]?.speaker;

    if (!turnText) {
      activeRequestsRef.current--;
      return;
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: turnText, speaker, speed }),
      });

      // セッション変更チェック
      if (debateSessionRef.current !== sessionId) {
        activeRequestsRef.current--;
        return;
      }

      if (!res.ok) throw new Error('音声合成に失敗しました。');

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const endTime = performance.now();
      const generationTimeMs = endTime - startTime;

      // セッション変更チェック
      if (debateSessionRef.current !== sessionId) {
        URL.revokeObjectURL(audioUrl);
        activeRequestsRef.current--;
        return;
      }

      // 音声の長さを取得（ブラウザ互換性のために複数イベント + タイムアウト）
      const tempAudio = new Audio();
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.warn(`音声読み込みタイムアウト: ターン ${index}、フォールバック長さを使用`);
          onLoaded();
        }
      }, AUDIO_LOAD_TIMEOUT_MS);

      /** 音声メタデータ読み込み完了時のハンドラ */
      const onLoaded = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);

        if (debateSessionRef.current !== sessionId) {
          cleanup();
          URL.revokeObjectURL(audioUrl);
          return;
        }

        let duration = tempAudio.duration;
        // ブラウザがWAVの長さを取得できない場合のフォールバック
        if (!duration || isNaN(duration) || duration === Infinity) {
          duration = Math.max(1.5, (turnText.length * 0.25) / speed);
        }

        cleanup();

        setTurns((prev) => {
          if (debateSessionRef.current !== sessionId) return prev;
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              audioUrl,
              duration,
              status: 'ready',
              generationTimeMs,
            };
          }

          // 統計を再計算
          calculateStats(updated);
          return updated;
        });

        activeRequestsRef.current--;
        processNextTtsRequests(sessionId);
      };

      /** 音声読み込みエラー時のハンドラ */
      const handleError = (e: unknown) => {
        console.error(`音声読み込みエラー: ターン ${index}:`, e);
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        cleanup();

        if (debateSessionRef.current !== sessionId) {
          URL.revokeObjectURL(audioUrl);
          return;
        }

        handleTtsError(index, sessionId);
      };

      /** イベントリスナーのクリーンアップ */
      const cleanup = () => {
        tempAudio.removeEventListener('loadedmetadata', onLoaded);
        tempAudio.removeEventListener('canplay', onLoaded);
        tempAudio.removeEventListener('error', handleError);
      };

      tempAudio.addEventListener('loadedmetadata', onLoaded);
      tempAudio.addEventListener('canplay', onLoaded);
      tempAudio.addEventListener('error', handleError);

      tempAudio.src = audioUrl;
      tempAudio.load(); // ブラウザ互換性のために明示的にロードを呼び出す
    } catch (err) {
      console.error(`TTS ターン ${index} 失敗:`, err);
      if (debateSessionRef.current !== sessionId) {
        activeRequestsRef.current--;
        return;
      }
      handleTtsError(index, sessionId);
    }
  }, []);

  /**
   * TTSエラー時の処理
   * ターンのステータスをerrorに設定し、次のリクエストを開始する
   */
  const handleTtsError = useCallback((index: number, sessionId: number) => {
    setTurns((prev) => {
      if (debateSessionRef.current !== sessionId) return prev;
      const updated = [...prev];
      if (updated[index]) updated[index].status = 'error';
      return updated;
    });
    activeRequestsRef.current--;
    processNextTtsRequests(sessionId);
  }, []);

  // =========================================================================
  // 統計計算
  // =========================================================================

  /**
   * 平均TTS生成速度を再計算する
   * ready状態のターンの生成時間と文字数から算出
   */
  const calculateStats = useCallback((currentTurns: TurnState[]) => {
    const readyTurns = currentTurns.filter(
      (t) => t.status === 'ready' && t.generationTimeMs !== undefined
    );
    if (readyTurns.length === 0) return;

    let totalGenTimeMs = 0;
    let totalChars = 0;

    readyTurns.forEach((t) => {
      totalGenTimeMs += t.generationTimeMs!;
      totalChars += t.text.length;
    });

    // 秒/文字 の平均生成速度
    const avgSpeed = totalGenTimeMs / 1000 / totalChars;
    setAverageSpeed(avgSpeed);
  }, []);

  // =========================================================================
  // バッファリング状態の判定
  // =========================================================================

  /**
   * 現在のバッファ状態を計算する
   * 再生開始可能かどうかと、表示用メッセージを返す
   */
  const getBufferState = useCallback((): BufferState => {
    const currentTurns = turns;
    const currentIdx = currentIndex;

    const totalTurns = currentTurns.length;
    if (totalTurns === 0) return { canPlay: false, msg: '台本準備中...' };

    const ungeneratedTurns = currentTurns.filter(
      (t) => t.status === 'pending' || t.status === 'loading'
    );

    // 全ターンが生成済み or エラーなら再生可能
    if (ungeneratedTurns.length === 0) {
      return { canPlay: true, msg: 'すべての音声生成完了' };
    }

    // 未生成ターンの合計文字数
    const remainingCharsToGenerate = ungeneratedTurns.reduce(
      (sum, t) => sum + t.text.length,
      0
    );

    // 平均速度が未算出の場合は、最低2ターン分の生成を待つ
    const readyCount = currentTurns.filter((t) => t.status === 'ready').length;
    if (readyCount < MIN_BUFFER_TURNS && averageSpeed === null) {
      return {
        canPlay: false,
        msg: `初期バッファ生成中 (${readyCount}/${MIN_BUFFER_TURNS})...`,
      };
    }

    const speed = averageSpeed || DEFAULT_ESTIMATED_SPEED;
    const estimatedGenTimeRemaining = remainingCharsToGenerate * speed;

    // 現在位置以降のバッファ済み再生時間を合計
    let bufferedPlaytimeRemaining = 0;
    currentTurns.forEach((t, i) => {
      if (i >= currentIdx && t.status === 'ready' && t.duration) {
        bufferedPlaytimeRemaining += t.duration;
      }
    });

    // 再生中の音声の残り時間を加算
    if (isPlaying && audioRef.current) {
      const currentRemaining =
        audioRef.current.duration - audioRef.current.currentTime;
      if (!isNaN(currentRemaining)) {
        bufferedPlaytimeRemaining += currentRemaining;
      }
    }

    // バッファ条件: バッファ再生時間 >= 推定生成時間 × 安全マージン
    const canPlay =
      bufferedPlaytimeRemaining >= estimatedGenTimeRemaining * BUFFER_SAFETY_MARGIN;

    // 代替条件: 50%以上のターンが準備済みなら開始可能
    const percentReady = (readyCount / totalTurns) * 100;
    const metPercentThreshold = percentReady >= BUFFER_PERCENT_THRESHOLD;

    const resultCanPlay = canPlay || metPercentThreshold;

    return {
      canPlay: resultCanPlay,
      msg: resultCanPlay
        ? '再生準備完了（バックグラウンドで残りを生成中）'
        : `バッファ蓄積中... (再生プール: ${Math.round(bufferedPlaytimeRemaining)}秒 / 必要生成: ${Math.round(estimatedGenTimeRemaining)}秒)`,
    };
  }, [turns, currentIndex, isPlaying, averageSpeed]);

  const bufferState = getBufferState();

  // =========================================================================
  // 自動再生開始（バッファが十分になったら再生を開始）
  // =========================================================================

  useEffect(() => {
    if (screen === 'adv' && currentIndex === -1 && bufferState.canPlay) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [bufferState.canPlay, screen, currentIndex]);

  // =========================================================================
  // 音声再生・バッファリング制御
  // =========================================================================

  useEffect(() => {
    if (screen !== 'adv' || currentIndex === -1) return;

    const turn = turns[currentIndex];
    if (!turn) return;

    // 1. バッファアンダーフロー: 音声が未生成なら再生を一時停止
    if (turn.status === 'pending' || turn.status === 'loading') {
      setIsBuffering(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    // 2. バッファ復帰: バッファリング状態を解除
    setIsBuffering(false);

    // 3. 同じ音声ソースの場合は再生/一時停止のみ切り替え
    if (audioRef.current && audioRef.current.src === turn.audioUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
      return;
    }

    // 4. 新しい音声ソースを初期化して再生
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(turn.audioUrl!);
    audioRef.current = audio;

    // ターンのステータスを「再生中」に更新
    setTurns((prev) => {
      const updated = [...prev];
      updated.forEach((t, i) => {
        if (t.status === 'playing') updated[i].status = 'played';
      });
      if (updated[currentIndex]) updated[currentIndex].status = 'playing';
      return updated;
    });

    // 音声再生終了時の処理
    audio.addEventListener('ended', () => {
      setTurns((prev) => {
        const updated = [...prev];
        if (updated[currentIndex]) updated[currentIndex].status = 'played';
        return updated;
      });

      // 次のターンがあれば進む、なければ討論終了
      if (currentIndex + 1 < turnsRef.current.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsPlaying(false);
        setIsDebateFinished(true);
      }
    });

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error('音声再生エラー:', err);
      });
    }

    return () => {
      audio.pause();
    };
  }, [currentIndex, isPlaying, screen, turns]);

  // =========================================================================
  // 公開操作関数
  // =========================================================================

  /**
   * 討論を開始する
   * APIから台本を取得し、TTS音声の生成キューを開始する
   */
  const startDebate = useCallback(
    async (topic: string, speed: number) => {
      const sessionId = Date.now();
      debateSessionRef.current = sessionId;

      setSpeed(speed);
      onScreenChange('generating');
      addLog('Gemini API を呼び出し中...');
      addLog('議題の検証とWeb検索クエリの作成を行っています...');

      try {
        const response = await fetch('/api/debate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || '討論の生成に失敗しました。');
        }

        const data: DebateData = await response.json();
        addLog('討論台本の生成が完了しました！');
        addLog(`総ターン数: ${data.turns.length} ターン`);

        if (data.search_queries && data.search_queries.length > 0) {
          addLog(`Web検索キーワード: ${data.search_queries.join(', ')}`);
          setSearchQueries(data.search_queries);
        } else {
          setSearchQueries([]);
        }

        setDebateTopic(data.topic || topic);

        // ターン状態を初期化
        const initialTurns: TurnState[] = data.turns.map((t) => ({
          ...t,
          audioUrl: null,
          duration: null,
          status: 'pending',
        }));

        setTurns(initialTurns);
        turnsRef.current = initialTurns;
        setAverageSpeed(null);
        setCurrentIndex(-1);
        setIsPlaying(false);
        setIsBuffering(false);
        onScreenChange('adv');

        // TTS生成キューを開始
        startTtsQueue(initialTurns, sessionId);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : '不明なエラーが発生しました';
        alert(`エラーが発生しました: ${message}`);
        onScreenChange('input');
      }
    },
    [addLog, onScreenChange, startTtsQueue]
  );

  /** 再生/一時停止を切り替える */
  const handlePlayPause = useCallback(() => {
    const isFinished =
      currentIndex === turns.length - 1 &&
      turns[currentIndex]?.status === 'played';

    if (currentIndex === -1 || isFinished) {
      // 最初から再生し直す
      setTurns((prev) => {
        const updated = [...prev];
        updated.forEach((t, i) => {
          if (t.status === 'played' || t.status === 'playing') {
            updated[i].status = 'ready';
          }
        });
        return updated;
      });
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  }, [currentIndex, turns, isPlaying]);

  /** 次のターンへスキップ */
  const handleSkipForward = useCallback(() => {
    if (currentIndex + 1 < turns.length) {
      if (audioRef.current) audioRef.current.pause();
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    }
  }, [currentIndex, turns.length]);

  /** 前のターンへ戻る */
  const handleSkipBackward = useCallback(() => {
    if (currentIndex > 0) {
      if (audioRef.current) audioRef.current.pause();

      // 現在以降のターンのステータスをreadyにリセット
      setTurns((prev) => {
        const updated = [...prev];
        for (let i = currentIndex; i < updated.length; i++) {
          if (
            updated[i].status === 'played' ||
            updated[i].status === 'playing'
          ) {
            updated[i].status = 'ready';
          }
        }
        return updated;
      });

      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    }
  }, [currentIndex]);

  /** 討論を終了してトップに戻る */
  const handleQuitDebate = useCallback(() => {
    // セッションをキャンセル
    debateSessionRef.current = 0;
    requestQueueRef.current = [];
    activeRequestsRef.current = 0;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Blob URLを解放
    turns.forEach((t) => {
      if (t.audioUrl) URL.revokeObjectURL(t.audioUrl);
    });

    setTurns([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setIsBuffering(false);
    setIsDebateFinished(false);
    setSearchQueries([]);
    setDebateTopic('');

    onScreenChange('input');
  }, [turns, onScreenChange]);

  /** 討論をもう一度最初から再生する */
  const handleReplayDebate = useCallback(() => {
    setIsDebateFinished(false);
    setTurns((prev) => {
      const updated = [...prev];
      updated.forEach((t, i) => {
        if (t.status === 'played' || t.status === 'playing') {
          updated[i] = { ...updated[i], status: 'ready' };
        }
      });
      return updated;
    });
    setCurrentIndex(0);
    setIsPlaying(true);
  }, []);

  // =========================================================================
  // キャラクター画像取得
  // =========================================================================

  /** 現在のターン情報（派生値） */
  const currentTurn = currentIndex !== -1 ? turns[currentIndex] : null;
  const activeSpeaker = currentTurn?.speaker || null;
  const currentEmotion = currentTurn?.emotion || 'default';

  /** Speaker1の画像パスを取得する */
  const getSpeaker1Img = useCallback((): string => {
    if (activeSpeaker === 'Speaker1') {
      if (currentEmotion === 'serious') return CHARACTER_IMAGES.Speaker1.serious;
      if (currentEmotion === 'angry') return CHARACTER_IMAGES.Speaker1.angry;
    }
    return CHARACTER_IMAGES.Speaker1.default;
  }, [activeSpeaker, currentEmotion]);

  /** Speaker2の画像パスを取得する */
  const getSpeaker2Img = useCallback((): string => {
    if (activeSpeaker === 'Speaker2') {
      if (currentEmotion === 'serious') return CHARACTER_IMAGES.Speaker2.serious;
      if (currentEmotion === 'angry') return CHARACTER_IMAGES.Speaker2.angry;
    }
    return CHARACTER_IMAGES.Speaker2.default;
  }, [activeSpeaker, currentEmotion]);

  // =========================================================================
  // 返り値
  // =========================================================================

  return {
    turns,
    currentIndex,
    isPlaying,
    isBuffering,
    isDebateFinished,
    debateTopic,
    searchQueries,
    bufferState,
    speakerConfig,
    currentTurn,
    activeSpeaker,
    currentEmotion,
    startDebate,
    handlePlayPause,
    handleSkipForward,
    handleSkipBackward,
    handleQuitDebate,
    handleReplayDebate,
    getSpeaker1Img,
    getSpeaker2Img,
  };
}
