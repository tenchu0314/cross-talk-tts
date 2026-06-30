/**
 * DebatePlayerScreen.tsx — ADV討論再生画面
 *
 * キャラクター立ち絵、セリフボックス、再生操作、進捗バー、
 * バッファリングオーバーレイ、討論終了オーバーレイを統合する画面。
 * useDebatePlayer Hook から受け取った状態と操作関数で駆動する。
 */

import { DEBATE_BG } from '../../constants';
import type { DebatePlayerState } from '../../hooks/useDebatePlayer';
import { CharacterSprite } from '../ui/CharacterSprite';
import { DialogueBox } from '../ui/DialogueBox';
import { PlaybackControls } from '../ui/PlaybackControls';
import { ProgressTrack } from '../ui/ProgressTrack';
import { BufferingOverlay } from '../ui/BufferingOverlay';
import { DebateEndOverlay } from '../ui/DebateEndOverlay';
import { BufferingTitleOverlay } from '../ui/BufferingTitleOverlay';
import './DebatePlayerScreen.css';

type DebatePlayerScreenProps = DebatePlayerState;

/** ADV討論再生画面コンポーネント */
export function DebatePlayerScreen(props: DebatePlayerScreenProps) {
  const {
    turns,
    currentIndex,
    isPlaying,
    isBuffering,
    isDebateFinished,
    debateTopic,
    searchQueries,
    bufferState,
    speakerConfig,
    hideUI,
    currentTurn,
    activeSpeaker,
    currentEmotion,
    handlePlayPause,
    handleSkipForward,
    handleSkipBackward,
    handleQuitDebate,
    handleReplayDebate,
    getSpeaker1Img,
    getSpeaker2Img,
  } = props;

  // バッファリング中（初期バッファリングまたは再生中の追加バッファリング）であるか
  const isBufferingState = isBuffering || (currentIndex === -1 && !bufferState.canPlay);
  // UI非表示モードかつバッファ中の場合はタイトル画面を表示する
  const showBufferingTitle = hideUI && isBufferingState;

  return (
    <div
      className="adv-screen"
      style={{ backgroundImage: `url(${DEBATE_BG})` }}
    >
      {/* キャラクター立ち絵エリア */}
      <div className="characters-stage">
        {/* Speaker 1 (左) */}
        <CharacterSprite
          character="speaker1"
          isActive={activeSpeaker === 'Speaker1'}
          emotion={currentEmotion}
          imageSrc={getSpeaker1Img()}
          displayName={speakerConfig.speaker1Name}
        />

        {/* Speaker 2 (右) */}
        <CharacterSprite
          character="speaker2"
          isActive={activeSpeaker === 'Speaker2'}
          emotion={currentEmotion}
          imageSrc={getSpeaker2Img()}
          displayName={speakerConfig.speaker2Name}
        />
      </div>

      {/* バッファリング時のタイトル画面（UI非表示モードかつバッファ中） */}
      {showBufferingTitle && (
        <BufferingTitleOverlay debateTopic={debateTopic} />
      )}

      {/* セリフボックス (タイトル画面を表示しない時のみ表示) */}
      {!showBufferingTitle && (
        <DialogueBox currentTurn={currentTurn} speakerConfig={speakerConfig}>
          {/* フッター: 操作・メタ情報・進捗 */}
          {!hideUI && (
            <div className="dialogue-footer">
              {/* 再生操作ボタン */}
              <PlaybackControls
                isPlaying={isPlaying}
                canPlay={bufferState.canPlay}
                currentIndex={currentIndex}
                totalTurns={turns.length}
                onPlayPause={handlePlayPause}
                onSkipForward={handleSkipForward}
                onSkipBackward={handleSkipBackward}
              />

              {/* 議題と終了ボタン */}
              <div className="dialogue-meta-panel">
                <div className="debate-topic-container">
                  <span className="debate-topic-label">議題: {debateTopic}</span>
                  {searchQueries.length > 0 && (
                    <span className="search-queries-tag">
                      🔍 {searchQueries[0]}
                    </span>
                  )}
                </div>
                <button className="close-debate-btn" onClick={handleQuitDebate}>
                  終了する
                </button>
              </div>

              {/* ターン進捗バー */}
              <ProgressTrack
                turns={turns}
                currentIndex={currentIndex}
                isPlaying={isPlaying}
                isBuffering={isBuffering}
              />
            </div>
          )}

          {/* バッファリングオーバーレイ（再生中のバッファ待ち。通常UIモード時のみ） */}
          {isBuffering && (
            <BufferingOverlay message="音声の生成を待っています..." />
          )}

          {/* 初期バッファリングオーバーレイ（再生開始前。通常UIモード時のみ） */}
          {currentIndex === -1 && !bufferState.canPlay && (
            <BufferingOverlay message={bufferState.msg} />
          )}
        </DialogueBox>
      )}

      {/* 討論終了オーバーレイ */}
      {isDebateFinished && (
        <DebateEndOverlay
          topic={debateTopic}
          onReplay={handleReplayDebate}
          onQuit={handleQuitDebate}
        />
      )}
    </div>
  );
}
