import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extractVoiceFeatures,
  SAMPLE_VOICE_FEATURES,
  silenceThreshold,
  type ExtractedVoice,
} from '@/integrations/voice/features';

/**
 * Real microphone capture.
 *
 * The microphone is the primary path, not a fallback. Audio is captured with
 * MediaRecorder while an AnalyserNode measures every frame, and the five
 * summary measures are computed from those real measurements when the
 * recording stops.
 *
 * The recording itself is held only for as long as an optional transcription
 * needs it, then dropped: no upload by default, no persistence, no blob left
 * in application state. The sample reading exists only for browsers that
 * cannot capture at all.
 */

export type RecorderState =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'processing'
  | 'ready'
  | 'unsupported';

export type RecorderSource = 'microphone' | 'sample' | null;

interface UseVoiceRecorder {
  state: RecorderState;
  source: RecorderSource;
  elapsedMs: number;
  /** Live input level, 0..1, for the meter. */
  level: number;
  /** True while the analyser considers the current frame to be speech. */
  speaking: boolean;
  features: ExtractedVoice | null;
  /** Held only until submission or discard, and only for transcription. */
  audio: Blob | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  useSample: () => void;
  reset: () => void;
}

const FRAME_INTERVAL_MS = 50;

export const useVoiceRecorder = (): UseVoiceRecorder => {
  const [state, setState] = useState<RecorderState>('idle');
  const [source, setSource] = useState<RecorderSource>(null);
  const [elapsedMs, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [features, setFeatures] = useState<ExtractedVoice | null>(null);
  const [audio, setAudio] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const frameTimer = useRef<number | null>(null);
  const clockTimer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const rmsRef = useRef<number[]>([]);
  const zcrRef = useRef<number[]>([]);

  const teardown = useCallback(() => {
    if (frameTimer.current !== null) window.clearInterval(frameTimer.current);
    if (clockTimer.current !== null) window.clearInterval(clockTimer.current);
    frameTimer.current = null;
    clockTimer.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => teardown, [teardown]);

  const start = useCallback(async () => {
    setError(null);
    setFeatures(null);
    setAudio(null);
    rmsRef.current = [];
    zcrRef.current = [];
    chunksRef.current = [];

    const supported =
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof window.AudioContext !== 'undefined' &&
      typeof window.MediaRecorder !== 'undefined';

    if (!supported) {
      setState('unsupported');
      setError('This browser does not expose microphone capture.');
      return;
    }

    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      context.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;

      // The recording is captured so that transcription has something to read.
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.start();

      startedAt.current = Date.now();
      setElapsed(0);
      setSource('microphone');
      setState('recording');

      const buffer = new Float32Array(analyser.fftSize);

      // One measurement per frame: amplitude and zero crossings. This is the
      // genuine measurement the features are computed from.
      frameTimer.current = window.setInterval(() => {
        const node = analyserRef.current;
        if (!node) return;
        node.getFloatTimeDomainData(buffer);

        let sumSquares = 0;
        let crossings = 0;
        for (let i = 0; i < buffer.length; i += 1) {
          const sample = buffer[i];
          sumSquares += sample * sample;
          if (i > 0 && ((sample >= 0 && buffer[i - 1] < 0) || (sample < 0 && buffer[i - 1] >= 0))) {
            crossings += 1;
          }
        }
        const rms = Math.sqrt(sumSquares / buffer.length);
        rmsRef.current.push(rms);
        zcrRef.current.push(crossings / buffer.length);

        setLevel(Math.min(1, rms * 6));
        setSpeaking(rms >= silenceThreshold(rmsRef.current));
      }, FRAME_INTERVAL_MS);

      clockTimer.current = window.setInterval(() => {
        setElapsed(Date.now() - startedAt.current);
      }, 100);
    } catch {
      setState('unsupported');
      setError('Microphone permission was not granted.');
      teardown();
    }
  }, [teardown]);

  const stop = useCallback(() => {
    const durationMs = Date.now() - startedAt.current;
    const rms = [...rmsRef.current];
    const zcr = [...zcrRef.current];
    const recorder = recorderRef.current;

    setState('processing');
    setLevel(0);
    setSpeaking(false);

    const finish = () => {
      const blob =
        chunksRef.current.length > 0
          ? new Blob(chunksRef.current, { type: recorder?.mimeType || 'audio/webm' })
          : null;
      chunksRef.current = [];
      rmsRef.current = [];
      zcrRef.current = [];

      setAudio(blob);
      setFeatures(extractVoiceFeatures({ rms, zcr, durationMs }));
      setState('ready');
      teardown();
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = finish;
      recorder.stop();
    } else {
      finish();
    }
  }, [teardown]);

  const useSample = useCallback(() => {
    setError(null);
    setAudio(null);
    setSource('sample');
    setFeatures(SAMPLE_VOICE_FEATURES);
    setElapsed(SAMPLE_VOICE_FEATURES.durationMs);
    setState('ready');
  }, []);

  const reset = useCallback(() => {
    teardown();
    recorderRef.current = null;
    chunksRef.current = [];
    setState('idle');
    setSource(null);
    setElapsed(0);
    setLevel(0);
    setSpeaking(false);
    setFeatures(null);
    setAudio(null);
    setError(null);
  }, [teardown]);

  return {
    state,
    source,
    elapsedMs,
    level,
    speaking,
    features,
    audio,
    error,
    start,
    stop,
    useSample,
    reset,
  };
};
