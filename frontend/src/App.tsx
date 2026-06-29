import { useState, useEffect, useRef } from 'react';
import './App.css';

interface DebateTurn {
  speaker: 'Speaker1' | 'Speaker2';
  text: string;
  emotion: 'default' | 'serious' | 'angry';
}

interface TurnState extends DebateTurn {
  audioUrl: string | null;
  duration: number | null;
  status: 'pending' | 'loading' | 'ready' | 'playing' | 'played' | 'error';
  generationTimeMs?: number;
}

interface DebateData {
  topic: string;
  search_queries?: string[];
  turns: DebateTurn[];
}

export default function App() {
  const [screen, setScreen] = useState<'health-check' | 'input' | 'generating' | 'adv' | 'connection-error'>('health-check');
  const [ttsHealthError, setTtsHealthError] = useState<string>('');
  
  // Debate Input
  const [topic, setTopic] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Debate Playback State
  const [debateTopic, setDebateTopic] = useState('');
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [turns, setTurns] = useState<TurnState[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Average TTS generation statistics
  const [averageSpeed, setAverageSpeed] = useState<number | null>(null); // seconds per character
  
  // Image paths
  const claireDefault = '/assets/claire_default.png';
  const claireSerious = '/assets/claire_serious.png';
  const claireAngry = '/assets/claire_angry.png';
  const karenDefault = '/assets/karen_default.png';
  const karenSerious = '/assets/karen_serious.png';
  const karenAngry = '/assets/karen_angry.png';
  const debateBg = '/assets/debate_bg.png';

  // Refs for audio playback and queues
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const turnsRef = useRef<TurnState[]>([]);
  const currentIndexRef = useRef<number>(-1);
  const isPlayingRef = useRef<boolean>(false);
  const maxConcurrentRequests = 2;
  const activeRequestsRef = useRef<number>(0);
  const requestQueueRef = useRef<number[]>([]);
  const debateSessionRef = useRef<number>(0);

  // Update references to avoid closure capture issues in async loops
  useEffect(() => {
    turnsRef.current = turns;
  }, [turns]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Initial Health Check
  useEffect(() => {
    checkTtsHealth();
  }, []);

  const checkTtsHealth = async () => {
    setScreen('health-check');
    try {
      const res = await fetch('/api/tts/health');
      if (res.ok) {
        setScreen('input');
        setTtsHealthError('');
      } else {
        const data = await res.json();
        setTtsHealthError(data.message || 'TTS Server not responding.');
        setScreen('connection-error');
      }
    } catch (err: any) {
      setTtsHealthError('Unable to connect to backend server or Irodori-TTS-Server.');
      setScreen('connection-error');
    }
  };

  const addLog = (message: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Submit topic to generate debate
  const handleStartDebate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    const sessionId = Date.now();
    debateSessionRef.current = sessionId;

    setScreen('generating');
    setLogs([]);
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
      
      // Initialize Turns State
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
      setScreen('adv');

      // Start fetching audio in queue
      startTtsQueue(initialTurns, sessionId);

    } catch (error: any) {
      alert(`エラーが発生しました: ${error.message}`);
      setScreen('input');
    } finally {
    }
  };

  // Queue Controller for TTS Requests
  const startTtsQueue = (initialTurns: TurnState[], sessionId: number) => {
    activeRequestsRef.current = 0;
    requestQueueRef.current = initialTurns.map((_, index) => index);
    processNextTtsRequests(sessionId);
  };

  const processNextTtsRequests = (sessionId: number) => {
    if (debateSessionRef.current !== sessionId) return;
    while (activeRequestsRef.current < maxConcurrentRequests && requestQueueRef.current.length > 0) {
      const nextIndex = requestQueueRef.current.shift();
      if (nextIndex !== undefined) {
        fetchTtsForTurn(nextIndex, sessionId);
      }
    }
  };

  const fetchTtsForTurn = async (index: number, sessionId: number) => {
    activeRequestsRef.current++;

    if (debateSessionRef.current !== sessionId) {
      activeRequestsRef.current--;
      return;
    }

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
        body: JSON.stringify({ text: turnText, speaker }),
      });

      if (debateSessionRef.current !== sessionId) {
        activeRequestsRef.current--;
        return;
      }

      if (!res.ok) throw new Error('音声合成に失敗しました。');

      const blob = await res.blob();
      const audioUrl = URL.createObjectURL(blob);
      const endTime = performance.now();
      const generationTimeMs = endTime - startTime;

      if (debateSessionRef.current !== sessionId) {
        URL.revokeObjectURL(audioUrl);
        activeRequestsRef.current--;
        return;
      }

      // Get Audio Duration with robust events & timeout fallback
      const tempAudio = new Audio();
      let resolved = false;

      const timeoutId = setTimeout(() => {
        if (!resolved) {
          console.warn(`Audio loading timeout on turn ${index}, using fallback duration.`);
          onLoaded();
        }
      }, 5000); // 5 seconds safety timeout

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
        // Fallback if browser can't analyze WAV duration
        if (!duration || isNaN(duration) || duration === Infinity) {
          duration = Math.max(1.5, turnText.length * 0.25);
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
          
          // Re-calculate statistics
          calculateStats(updated);
          return updated;
        });

        activeRequestsRef.current--;
        processNextTtsRequests(sessionId);
      };

      const handleError = (e: any) => {
        console.error(`Audio loading error on turn ${index}:`, e);
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

      const cleanup = () => {
        tempAudio.removeEventListener('loadedmetadata', onLoaded);
        tempAudio.removeEventListener('canplay', onLoaded);
        tempAudio.removeEventListener('error', handleError);
      };

      tempAudio.addEventListener('loadedmetadata', onLoaded);
      tempAudio.addEventListener('canplay', onLoaded);
      tempAudio.addEventListener('error', handleError);

      tempAudio.src = audioUrl;
      tempAudio.load(); // Explicitly trigger load for browser compatibility

    } catch (err) {
      console.error(`TTS turn ${index} failed:`, err);
      if (debateSessionRef.current !== sessionId) {
        activeRequestsRef.current--;
        return;
      }
      handleTtsError(index, sessionId);
    }
  };

  const handleTtsError = (index: number, sessionId: number) => {
    setTurns((prev) => {
      if (debateSessionRef.current !== sessionId) return prev;
      const updated = [...prev];
      if (updated[index]) updated[index].status = 'error';
      return updated;
    });
    activeRequestsRef.current--;
    processNextTtsRequests(sessionId);
  };

  // Re-calculate average TTS generation speed
  const calculateStats = (currentTurns: TurnState[]) => {
    const readyTurns = currentTurns.filter((t) => t.status === 'ready' && t.generationTimeMs !== undefined);
    if (readyTurns.length === 0) return;

    let totalGenTimeMs = 0;
    let totalChars = 0;

    readyTurns.forEach((t) => {
      totalGenTimeMs += t.generationTimeMs!;
      totalChars += t.text.length;
    });

    const avgSpeed = (totalGenTimeMs / 1000) / totalChars; // seconds of generation per character
    setAverageSpeed(avgSpeed);
  };

  // Calculate buffering buffer status
  const getBufferState = () => {
    const currentTurns = turns;
    const currentIdx = currentIndex;

    const totalTurns = currentTurns.length;
    if (totalTurns === 0) return { canPlay: false, msg: '台本準備中...' };

    const ungeneratedTurns = currentTurns.filter((t) => t.status === 'pending' || t.status === 'loading');
    
    // If all turns are ready or error, we can play safely
    if (ungeneratedTurns.length === 0) {
      return { canPlay: true, msg: 'すべての音声生成完了' };
    }

    // How many characters left to generate
    const remainingCharsToGenerate = ungeneratedTurns.reduce((sum, t) => sum + t.text.length, 0);

    // Estimate remaining generation time
    // If averageSpeed isn't calculated yet, wait for at least first 2 turns to be ready
    const readyCount = currentTurns.filter((t) => t.status === 'ready').length;
    if (readyCount < 2 && averageSpeed === null) {
      return { canPlay: false, msg: `初期バッファ生成中 (${readyCount}/2)...` };
    }

    const speed = averageSpeed || 0.15; // default 0.15s per character if not yet calculated
    const estimatedGenTimeRemaining = remainingCharsToGenerate * speed;

    // Remaining playback time currently buffered
    let bufferedPlaytimeRemaining = 0;
    
    // sum up ready turns that are not played yet (from current index forward)
    currentTurns.forEach((t, i) => {
      if (i >= currentIdx && t.status === 'ready' && t.duration) {
        bufferedPlaytimeRemaining += t.duration;
      }
    });

    // Add current audio's remaining time if playing
    if (isPlaying && audioRef.current) {
      const currentRemaining = audioRef.current.duration - audioRef.current.currentTime;
      if (!isNaN(currentRemaining)) {
        bufferedPlaytimeRemaining += currentRemaining;
      }
    }

    // Buffer condition: buffered duration >= estimated generation duration * safety margin (1.1)
    const canPlay = bufferedPlaytimeRemaining >= estimatedGenTimeRemaining * 1.1;

    // Alternative: If at least 50% of the turns are ready, we can also start
    const percentReady = (readyCount / totalTurns) * 100;
    const metPercentThreshold = percentReady >= 50;

    const resultCanPlay = canPlay || metPercentThreshold;

    return {
      canPlay: resultCanPlay,
      msg: resultCanPlay 
        ? '再生準備完了（バックグラウンドで残りを生成中）' 
        : `バッファ蓄積中... (再生プール: ${Math.round(bufferedPlaytimeRemaining)}秒 / 必要生成: ${Math.round(estimatedGenTimeRemaining)}秒)`
    };
  };

  const bufferState = getBufferState();

  // Watch for canPlay and auto-trigger initial play
  useEffect(() => {
    if (screen === 'adv' && currentIndex === -1 && bufferState.canPlay) {
      setCurrentIndex(0);
      setIsPlaying(true);
    }
  }, [bufferState.canPlay, screen, currentIndex]);

  // Audio Playback effect
  useEffect(() => {
    if (screen !== 'adv' || currentIndex === -1) return;

    const turn = turns[currentIndex];
    if (!turn) return;

    if (turn.status !== 'ready') {
      // Buffer underflow! Stop audio and wait
      setIsBuffering(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      return;
    }

    setIsBuffering(false);

    // If audio is already created and current source is same, just control playback
    if (audioRef.current && audioRef.current.src === turn.audioUrl) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
      return;
    }

    // Initialize new audio element
    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(turn.audioUrl!);
    audioRef.current = audio;

    // Set playing state in turns
    setTurns((prev) => {
      const updated = [...prev];
      // Mark previous playing as played
      updated.forEach((t, i) => {
        if (t.status === 'playing') updated[i].status = 'played';
      });
      updated[currentIndex].status = 'playing';
      return updated;
    });

    audio.addEventListener('ended', () => {
      setTurns((prev) => {
        const updated = [...prev];
        updated[currentIndex].status = 'played';
        return updated;
      });

      if (currentIndex + 1 < turnsRef.current.length) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsPlaying(false);
        setCurrentIndex(-1); // debate finished
      }
    });

    if (isPlaying) {
      audio.play().catch((err) => {
        console.error("Audio playback error:", err);
      });
    }

    return () => {
      audio.pause();
    };

  }, [currentIndex, isPlaying, screen]);

  // Watch if buffering turn becomes ready, and resume
  useEffect(() => {
    if (isBuffering && currentIndex !== -1) {
      const turn = turns[currentIndex];
      if (turn && turn.status === 'ready') {
        setIsBuffering(false);
        if (isPlaying && audioRef.current) {
          audioRef.current.src = turn.audioUrl!;
          // Mark status
          setTurns((prev) => {
            const updated = [...prev];
            updated[currentIndex].status = 'playing';
            return updated;
          });
          audioRef.current.play().catch(console.error);
        }
      }
    }
  }, [turns, isBuffering, currentIndex, isPlaying]);

  const handlePlayPause = () => {
    if (currentIndex === -1) {
      // Re-trigger from beginning
      // Reset statuses
      setTurns((prev) => {
        const updated = [...prev];
        updated.forEach((t, i) => {
          if (t.status === 'played' || t.status === 'playing') {
            updated[i].status = 'ready'; // reset to ready for replay
          }
        });
        return updated;
      });
      setCurrentIndex(0);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSkipForward = () => {
    if (currentIndex + 1 < turns.length) {
      if (audioRef.current) audioRef.current.pause();
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    }
  };

  const handleSkipBackward = () => {
    if (currentIndex > 0) {
      if (audioRef.current) audioRef.current.pause();
      
      // Reset status of current/subsequent turns to ready
      setTurns((prev) => {
        const updated = [...prev];
        for (let i = currentIndex; i < updated.length; i++) {
          if (updated[i].status === 'played' || updated[i].status === 'playing') {
            updated[i].status = 'ready';
          }
        }
        return updated;
      });

      setCurrentIndex(currentIndex - 1);
      setIsPlaying(true);
    }
  };

  const handleQuitDebate = () => {
    // Session cancel
    debateSessionRef.current = 0;
    requestQueueRef.current = [];
    activeRequestsRef.current = 0;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    // Clean up urls
    turns.forEach((t) => {
      if (t.audioUrl) URL.revokeObjectURL(t.audioUrl);
    });

    setTurns([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setIsBuffering(false);
    setSearchQueries([]);
    setDebateTopic('');
    
    setScreen('input');
  };

  // Determine current active speaker
  const currentTurn = currentIndex !== -1 ? turns[currentIndex] : null;
  const activeSpeaker = currentTurn?.speaker || null;
  const currentEmotion = currentTurn?.emotion || 'default';

  // Determine images based on speaker & emotion
  const getClaireImg = () => {
    if (activeSpeaker === 'Speaker1') {
      if (currentEmotion === 'serious') return claireSerious;
      if (currentEmotion === 'angry') return claireAngry;
    }
    return claireDefault;
  };

  const getKarenImg = () => {
    if (activeSpeaker === 'Speaker2') {
      if (currentEmotion === 'serious') return karenSerious;
      if (currentEmotion === 'angry') return karenAngry;
    }
    return karenDefault;
  };

  return (
    <div className="app-container">
      {screen === 'health-check' && (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <h2 className="loading-title">TTS サーバー接続確認中</h2>
          <p className="loading-step-desc">Irodori-TTS-Serverへの接続を確認しています...</p>
        </div>
      )}

      {screen === 'connection-error' && (
        <div className="error-screen">
          <div className="error-icon">⚠️</div>
          <h2 className="error-title">TTS サーバー接続エラー</h2>
          <p className="error-message">{ttsHealthError}</p>
          <button className="retry-button" onClick={checkTtsHealth}>
            再接続を試行
          </button>
        </div>
      )}

      {screen === 'input' && (
        <div className="setup-screen">
          <header className="app-header">
            <h1 className="app-title">Cross-Talk TTS</h1>
            <p className="app-subtitle">GeminiとローカルTTSによるキャラクター討論システム</p>
          </header>
          
          <form className="setup-form" onSubmit={handleStartDebate}>
            <div className="character-preview-grid">
              <div className="character-card claire">
                <div className="card-title">🛡️ クレア</div>
                <div className="card-desc">Speaker 1: 論理的・データ重視・丁寧な口調。客観的なファクトと数字を突きつける知的な討論者。</div>
              </div>
              <div className="character-card karen">
                <div className="card-title">🔥 カレン</div>
                <div className="card-desc">Speaker 2: 感情的・現場の代弁者。実体験や人間味、情熱を持って実情を訴えかける討論者。</div>
              </div>
            </div>

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
            
            <button className="start-button" type="submit" disabled={!topic.trim()}>
              討論台本を作成して開始
            </button>
          </form>
        </div>
      )}

      {screen === 'generating' && (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <h2 className="loading-title">討論生成中</h2>
          <p className="loading-step-desc">GeminiがWebサーチを使いながら説得力のある台本を作成しています...</p>
          
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
      )}

      {screen === 'adv' && (
        <div 
          className="adv-screen" 
          style={{ backgroundImage: `url(${debateBg})` }}
        >
          {/* Top Panel for Metadata */}
          <div className="adv-header-panel">
            <span className="debate-topic-label">議題: {debateTopic}</span>
            {searchQueries.length > 0 && (
              <span className="search-queries-tag">
                🔍 {searchQueries[0]}
              </span>
            )}
            <button className="close-debate-btn" onClick={handleQuitDebate}>
              終了する
            </button>
          </div>

          {/* Characters Presentation */}
          <div className="characters-stage">
            {/* Claire (Left) */}
            <div className={`character-sprite-container claire ${activeSpeaker === 'Speaker1' ? 'active' : 'inactive'}`}>
              <img 
                className="character-sprite" 
                src={getClaireImg()} 
                alt="Claire"
                onError={(e) => {
                  // Fallback if image not generated yet
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                  if (sibling) sibling.style.display = 'flex';
                }}
              />
              <div className="character-placeholder" style={{ display: 'none' }}>
                <span className="character-placeholder-name">クレア</span>
                <span style={{ fontSize: '0.8rem' }}>
                  {activeSpeaker === 'Speaker1' ? `表情: ${currentEmotion}` : '待機中'}
                </span>
              </div>
            </div>

            {/* Karen (Right) */}
            <div className={`character-sprite-container karen ${activeSpeaker === 'Speaker2' ? 'active' : 'inactive'}`}>
              <img 
                className="character-sprite" 
                src={getKarenImg()} 
                alt="Karen"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                  if (sibling) sibling.style.display = 'flex';
                }}
              />
              <div className="character-placeholder" style={{ display: 'none' }}>
                <span className="character-placeholder-name">カレン</span>
                <span style={{ fontSize: '0.8rem' }}>
                  {activeSpeaker === 'Speaker2' ? `表情: ${currentEmotion}` : '待機中'}
                </span>
              </div>
            </div>
          </div>

          {/* Dialogue Box */}
          <div className="dialogue-window-container">
            <div className="dialogue-box">
              {/* Speaker Label */}
              {currentTurn && (
                <div className={`speaker-name-badge ${currentTurn.speaker === 'Speaker1' ? 'claire' : 'karen'}`}>
                  {currentTurn.speaker === 'Speaker1' ? 'クレア' : 'カレン'}
                </div>
              )}

              {/* Dialogue Text */}
              <div className="dialogue-text">
                {currentTurn ? currentTurn.text : '討論の開始を待っています...'}
              </div>

              {/* Controls and Buffer Indicator */}
              <div className="dialogue-footer">
                <div className="playback-controls">
                  <button 
                    className="control-btn" 
                    onClick={handleSkipBackward}
                    disabled={currentIndex <= 0}
                  >
                    ◀ 前へ
                  </button>
                  
                  <button 
                    className="control-btn primary" 
                    onClick={handlePlayPause}
                    disabled={currentIndex === -1 && !bufferState.canPlay}
                  >
                    {isPlaying ? '⏸ 一時停止' : '▶ 再生'}
                  </button>
                  
                  <button 
                    className="control-btn" 
                    onClick={handleSkipForward}
                    disabled={currentIndex === -1 || currentIndex >= turns.length - 1}
                  >
                    次へ ▶
                  </button>
                </div>

                {/* Progress Track */}
                <div className="debate-progress-stats">
                  <div className="progress-track-wrapper">
                    {turns.map((t, idx) => (
                      <div 
                        key={idx} 
                        className={`progress-node ${
                          idx === currentIndex && isPlaying && !isBuffering 
                            ? 'playing' 
                            : t.status
                        }`}
                        title={`ターン ${idx + 1}: ${t.status}`}
                      />
                    ))}
                  </div>
                  <span className="stats-text">
                    {turns.length > 0 
                      ? `進捗: ${turns.filter(t => t.status === 'ready' || t.status === 'played' || t.status === 'playing').length}/${turns.length} 生成完了`
                      : ''}
                  </span>
                </div>
              </div>

              {/* Buffering Overlay */}
              {isBuffering && (
                <div className="buffering-overlay">
                  <div className="buffering-spinner"></div>
                  <div className="buffering-text">音声の生成を待っています...</div>
                </div>
              )}

              {/* Initial Buffering Overlay before start */}
              {currentIndex === -1 && !bufferState.canPlay && (
                <div className="buffering-overlay">
                  <div className="buffering-spinner"></div>
                  <div className="buffering-text">{bufferState.msg}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
