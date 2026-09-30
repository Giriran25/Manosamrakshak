import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Mic, Play, Square, Trash2 } from 'lucide-react';
import type { InteractionEvent } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useTranscription } from '@/hooks/useTranscription';
import { useTranslation } from '@/hooks/useTranslation';
import { describeVoice, toVoiceFeatures } from '@/integrations/voice/features';
import { CheckInOutcome } from './CheckInShared';
import { ChannelStatus } from '@/components/common/ChannelStatus';
import { InlineWarning } from '@/components/common/Primitives';
import { cn } from '@/lib/cn';

const EASE = [0.22, 1, 0.36, 1] as const;
const BARS = 40;

/**
 * Voice check-in, on a real microphone.
 *
 * MediaRecorder captures while an analyser measures every 50ms frame; when the
 * recording stops, the five summary measures are computed from those real
 * measurements. Where the browser provides speech recognition, what was said
 * is transcribed on the device and feeds the language stream, so a spoken
 * check-in is scored on its words as well as its acoustics.
 *
 * The recording is held only long enough for transcription and is then
 * dropped. Voice remains supporting evidence and can never place a case in the
 * high band on its own.
 */
export const VoiceCheckIn = ({ caseId }: { caseId: string }) => {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const recorder = useVoiceRecorder();
  const transcription = useTranscription();
  const submit = useAppStore((s) => s.submitInteraction);
  const lastIngest = useAppStore((s) => s.lastIngest);

  const [result, setResult] = useState<InteractionEvent | null>(null);
  const [sending, setSending] = useState(false);

  const begin = async () => {
    transcription.reset();
    await recorder.start();
    transcription.begin('en');
  };

  const finish = () => {
    transcription.end();
    recorder.stop();
  };

  const send = async () => {
    if (!recorder.features) return;
    setSending(true);

    // Where the browser could not transcribe, try a configured server service
    // once. If that is unavailable too, the check-in proceeds on the measures.
    let spoken = transcription.transcript.trim();
    if (!spoken && recorder.audio && transcription.state === 'unavailable') {
      spoken = (await transcription.fromServer(recorder.audio)) ?? '';
    }

    const outcome = await submit({
      caseId,
      channel: 'voice',
      voice: toVoiceFeatures(recorder.features),
      responses: [
        {
          questionId: 'q1-feeling',
          // A spoken check-in carries no keypad rating; the words, the
          // acoustics and the engagement measures do the work.
          value: null,
          freeText: spoken || undefined,
          latencyMs: Math.max(1_000, Math.round(recorder.features.durationMs / 3)),
        },
      ],
      skipped: 0,
    });

    setSending(false);
    if (outcome.event) setResult(outcome.event);
    // The recording is dropped here, transcribed or not.
    recorder.reset();
    transcription.reset();
  };

  if (result) {
    return (
      <div className="space-y-4">
        <CheckInOutcome
          event={result}
          onRestart={() => setResult(null)}
          restartLabel={t('checkin.another')}
        />
        {lastIngest ? (
          <p className="text-[12px] leading-relaxed text-ink-400">{lastIngest.note}</p>
        ) : null}
      </div>
    );
  }

  const seconds = Math.floor(recorder.elapsedMs / 1000);
  const isRecording = recorder.state === 'recording';
  const isProcessing = recorder.state === 'processing' || sending;
  const ready = recorder.state === 'ready' && Boolean(recorder.features);
  const plain = recorder.features ? describeVoice(recorder.features) : [];

  return (
    <div className="space-y-6">
      <ChannelStatus channel="voice" processing={isProcessing} />

      <div className="text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="font-display text-display-sm text-ink-900"
        >
          {t('checkin.takeAMoment')}
        </motion.p>
        <p className="mx-auto mt-2 max-w-[40ch] text-[14px] leading-relaxed text-ink-500">
          Say as much or as little as you like about how things have been. There is no right answer
          and nobody is timing you.
        </p>
      </div>

      {/* The capture control. */}
      <div className="flex flex-col items-center py-4">
        <div className="relative flex h-[196px] w-[196px] items-center justify-center">
          {isRecording && !reduced ? (
            <>
              <span
                aria-hidden
                className="absolute inset-0 animate-halo rounded-full border border-stream-voice/35"
              />
              <span
                aria-hidden
                className="absolute inset-0 animate-halo rounded-full border border-stream-voice/25"
                style={{ animationDelay: '0.9s' }}
              />
            </>
          ) : null}

          <motion.button
            type="button"
            onClick={() => (isRecording ? finish() : void begin())}
            disabled={isProcessing}
            aria-label={isRecording ? t('voice.stop') : t('voice.start')}
            className={cn(
              'relative flex h-[150px] w-[150px] flex-col items-center justify-center gap-2 rounded-full transition-colors duration-300',
              isRecording
                ? 'bg-band-high text-white'
                : isProcessing
                  ? 'bg-ivory-200 text-ink-400'
                  : 'bg-forest-700 text-ivory-50 hover:bg-forest-600',
            )}
            whileTap={reduced ? undefined : { scale: 0.97 }}
          >
            {isRecording ? (
              <Square aria-hidden className="h-6 w-6" />
            ) : (
              <Mic aria-hidden className="h-7 w-7" />
            )}
            <span className="px-4 text-center text-[12px] leading-tight">
              {isRecording
                ? t('voice.stop')
                : isProcessing
                  ? t('voice.processing')
                  : ready
                    ? 'Record again'
                    : t('voice.start')}
            </span>
          </motion.button>
        </div>

        <p
          className="mt-4 font-mono text-2xl tabular-nums text-ink-900"
          aria-live="polite"
          aria-atomic="true"
        >
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </p>
        <p className="mt-1 text-[12px] text-ink-400">
          {recorder.state === 'requesting'
            ? 'Waiting for microphone permission'
            : isRecording
              ? recorder.speaking
                ? `${t('voice.recording')} · speech detected`
                : `${t('voice.recording')} · quiet`
              : recorder.state === 'processing'
                ? t('voice.processing')
                : ready
                  ? recorder.source === 'sample'
                    ? 'Sample reading in use'
                    : 'Reading ready'
                  : 'Not recording'}
        </p>

        {/* Live level, mirrored so it reads as a voice rather than a chart. */}
        <div
          className="mt-5 flex h-14 w-full max-w-[420px] items-center justify-center gap-[3px]"
          aria-hidden
        >
          {Array.from({ length: BARS }).map((_, index) => {
            const distance = Math.abs(index - BARS / 2) / (BARS / 2);
            const height = isRecording
              ? Math.max(3, recorder.level * 52 * (1 - distance * 0.7))
              : 3;
            return (
              <motion.span
                key={index}
                className={cn(
                  'w-full rounded-full',
                  isRecording
                    ? recorder.speaking
                      ? 'bg-stream-voice/80'
                      : 'bg-stream-voice/35'
                    : 'bg-ivory-200',
                )}
                animate={{ height }}
                transition={{ duration: 0.12 }}
              />
            );
          })}
        </div>
      </div>

      {/* What is being heard, while it is being heard. */}
      {transcription.state === 'listening' || transcription.transcript ? (
        <div className="rounded-2xl border border-line bg-ivory-100/60 px-4 py-3.5">
          <p className="eyebrow">
            {transcription.source === 'server' ? 'Transcribed by the server' : 'Heard on this device'}
          </p>
          <p className="mt-2 min-h-[22px] text-[14px] leading-relaxed text-ink-700">
            {transcription.transcript || '...'}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" className="btn-primary" onClick={() => void send()} disabled={!ready || sending}>
          {t('voice.submitVoice')}
        </button>
        {ready ? (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              recorder.reset();
              transcription.reset();
            }}
          >
            <Trash2 aria-hidden className="h-3.5 w-3.5" />
            Discard
          </button>
        ) : null}
        {recorder.state === 'unsupported' || recorder.error ? (
          <button type="button" className="btn-secondary" onClick={recorder.useSample}>
            <Play aria-hidden className="h-3.5 w-3.5" />
            {t('voice.useSample')}
          </button>
        ) : null}
      </div>

      {recorder.state === 'unsupported' || recorder.error ? (
        <InlineWarning>
          {recorder.error ?? t('voice.noMic')} A fixed sample reading can be used instead so the
          check-in still works, and it is labelled as a sample wherever it appears.
        </InlineWarning>
      ) : null}

      {transcription.state === 'unavailable' && transcription.reason ? (
        <p className="text-center text-[12px] text-ink-400">
          Speech transcription unavailable: {transcription.reason} The check-in continues on the
          voice measures alone.
        </p>
      ) : null}

      <AnimatePresence>
        {ready ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="rounded-2xl border border-line bg-ivory-100/60 px-5 py-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="eyebrow">Your reading</p>
              {recorder.source === 'sample' ? (
                <span className="chip border-band-watch/30 bg-band-watch/10 text-band-watch">
                  sample reading
                </span>
              ) : (
                <span className="text-[11px] text-ink-400">
                  measured from {recorder.features?.frames ?? 0} frames of your recording
                </span>
              )}
            </div>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {plain.map((row) => (
                <div key={row.label} className="rounded-xl bg-paper px-4 py-3">
                  <dt className="text-[11.5px] text-ink-400">{row.label}</dt>
                  <dd className="mt-0.5 text-[14px] text-ink-900">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-400">
              {t('voice.discarded')} This reading is compared only against your own earlier
              check-ins, and on its own it never changes how your case is prioritised.
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
