import { useCallback, useEffect, useRef, useState } from 'react';
import { postTranscription } from '@/services/apiClient';

/**
 * Speech to text.
 *
 * The primary path is the browser's own recognition service: it needs no
 * credential and, where the browser supports it, keeps the audio on the
 * device. Where that is missing, a configured server-side service is tried
 * once. Where neither exists the check-in continues on the voice measures
 * alone and the screen says transcription is unavailable - it never pretends
 * to have heard words it did not.
 */

export type TranscriptionSource = 'browser' | 'server' | null;

export type TranscriptionState = 'idle' | 'listening' | 'working' | 'done' | 'unavailable';

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export const isBrowserTranscriptionAvailable = (): boolean => recognitionCtor() !== null;

const LOCALE: Record<string, string> = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' };

interface UseTranscription {
  state: TranscriptionState;
  transcript: string;
  source: TranscriptionSource;
  reason: string | null;
  /** Starts live recognition alongside the recording. */
  begin: (language: string) => void;
  /** Stops recognition; returns whatever was heard. */
  end: () => string;
  /** Last resort: sends the recording to a configured server service. */
  fromServer: (audio: Blob) => Promise<string | null>;
  reset: () => void;
}

export const useTranscription = (): UseTranscription => {
  const [state, setState] = useState<TranscriptionState>(
    isBrowserTranscriptionAvailable() ? 'idle' : 'unavailable',
  );
  const [transcript, setTranscript] = useState('');
  const [source, setSource] = useState<TranscriptionSource>(null);
  const [reason, setReason] = useState<string | null>(
    isBrowserTranscriptionAvailable() ? null : 'This browser does not provide speech recognition.',
  );

  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const collected = useRef('');

  useEffect(
    () => () => {
      try {
        recognition.current?.stop();
      } catch {
        // Already stopped.
      }
    },
    [],
  );

  const begin = useCallback((language: string) => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setState('unavailable');
      return;
    }
    collected.current = '';
    setTranscript('');

    try {
      const instance = new Ctor();
      instance.continuous = true;
      instance.interimResults = true;
      instance.lang = LOCALE[language] ?? 'en-IN';
      instance.onresult = (event) => {
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          const text = result[0]?.transcript ?? '';
          if (result.isFinal) finalText += `${text} `;
          else interim += text;
        }
        if (finalText) collected.current += finalText;
        setTranscript((collected.current + interim).trim());
      };
      instance.onerror = () => {
        setState('unavailable');
        setReason('Speech recognition stopped unexpectedly.');
      };
      instance.onend = () => {
        setState((current) => (current === 'listening' ? 'done' : current));
      };
      instance.start();
      recognition.current = instance;
      setSource('browser');
      setState('listening');
    } catch {
      setState('unavailable');
      setReason('Speech recognition could not be started.');
    }
  }, []);

  const end = useCallback((): string => {
    try {
      recognition.current?.stop();
    } catch {
      // Already stopped.
    }
    recognition.current = null;
    const text = collected.current.trim();
    if (text) {
      setTranscript(text);
      setState('done');
    }
    return text;
  }, []);

  const fromServer = useCallback(async (audio: Blob): Promise<string | null> => {
    setState('working');
    const result = await postTranscription(audio);
    if (result.transcript) {
      setTranscript(result.transcript);
      setSource('server');
      setState('done');
      return result.transcript;
    }
    setState('unavailable');
    setReason(result.reason ?? 'Speech transcription unavailable.');
    return null;
  }, []);

  const reset = useCallback(() => {
    collected.current = '';
    setTranscript('');
    setSource(null);
    setState(isBrowserTranscriptionAvailable() ? 'idle' : 'unavailable');
  }, []);

  return { state, transcript, source, reason, begin, end, fromServer, reset };
};
