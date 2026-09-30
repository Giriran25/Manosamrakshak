import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import type { Channel } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { ChannelChooser } from '@/components/checkin/ChannelChooser';
import { ChatCheckIn } from '@/components/checkin/ChatCheckIn';
import { VoiceCheckIn } from '@/components/checkin/VoiceCheckIn';
import { IvrsSimulator } from '@/components/checkin/IvrsSimulator';
import { SmsSimulator } from '@/components/checkin/SmsSimulator';
import { EmptyState, Eyebrow, InlineWarning } from '@/components/common/Primitives';
import type { TranslationKey } from '@/i18n/en';

const EASE = [0.22, 1, 0.36, 1] as const;

const CHANNEL_TITLES: Record<Channel, TranslationKey> = {
  chat: 'checkin.channelChat',
  voice: 'checkin.channelVoice',
  ivrs: 'checkin.channelIvrs',
  sms: 'checkin.channelSms',
};

/**
 * The check-in surface.
 *
 * Two states rather than a tab bar: choose how, then a single focused
 * experience with nothing else competing for attention. Backing out is always
 * one control away, and the choice is never lost - the four channels are
 * equals here, not a primary with three fallbacks.
 */
export const VictimCheckIn = () => {
  const { t } = useTranslation();
  const session = useAppStore((s) => s.session);
  const caseId = session?.caseId;
  const caseRecord = useAppStore((s) => s.cases.find((c) => c.caseId === caseId));
  const [channel, setChannel] = useState<Channel | null>(null);

  if (!caseId || !caseRecord) {
    return (
      <EmptyState
        title="No case is linked to this account"
        body="Check-ins are recorded against a case. Once a case exists, this screen becomes available."
      />
    );
  }

  /**
   * Deliberately not an exit-then-enter transition: the incoming view mounts
   * straight away and animates in. Waiting on an outgoing animation before
   * mounting the next screen is a transition that can stall, and a check-in is
   * not a place to risk that.
   */
  return (
    <div className="space-y-7">
      <AnimatePresence initial={false}>
        {channel === null ? (
          <motion.div
            key="chooser"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="space-y-7"
          >
            <header>
              <Eyebrow>{caseRecord.caseId}</Eyebrow>
              <h1 className="mt-3 max-w-[20ch] text-display-md text-ink-900">
                How would you like to check in today?
              </h1>
              <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-ink-500">
                {t('checkin.subtitle')} All four take about a minute, and all four reach your
                support team the same way.
              </p>
            </header>

            {!caseRecord.consent.passiveAnalysis ? (
              <InlineWarning>
                You have withdrawn permission for your check-ins to be analysed. Your answers are
                still recorded for your support team and the helpline is unchanged. Anything you
                write in a free-text box is not analysed.
              </InlineWarning>
            ) : null}

            <ChannelChooser onChoose={setChannel} />
          </motion.div>
        ) : (
          <motion.div
            key={channel}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="space-y-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Eyebrow>{t('checkin.title')}</Eyebrow>
                <h1 className="mt-1.5 text-display-sm text-ink-900">
                  {t(CHANNEL_TITLES[channel])}
                </h1>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setChannel(null)}
              >
                <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
                {t('checkin.chooseAnother')}
              </button>
            </div>

            <div className="rounded-3xl border border-line bg-paper px-4 py-6 sm:px-7 sm:py-7">
              {channel === 'chat' ? <ChatCheckIn caseId={caseId} /> : null}
              {channel === 'voice' ? <VoiceCheckIn caseId={caseId} /> : null}
              {channel === 'ivrs' ? <IvrsSimulator caseId={caseId} /> : null}
              {channel === 'sms' ? <SmsSimulator caseId={caseId} /> : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
