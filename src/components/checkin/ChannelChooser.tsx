import { motion } from 'framer-motion';
import { MessageSquare, Mic, Phone, Smartphone } from 'lucide-react';
import type { Channel } from '@/types';
import { useTranslation } from '@/hooks/useTranslation';
import type { TranslationKey } from '@/i18n/en';

/**
 * How a person chooses to check in.
 *
 * Not a tab bar. The choice matters - it is the difference between someone
 * with a smartphone and someone with a feature phone and no literacy - so
 * each option says what it is good for and how it works, and the cards are
 * large enough to hit with a thumb.
 */

interface Option {
  value: Channel;
  labelKey: TranslationKey;
  icon: typeof MessageSquare;
  bestFor: string;
  style: string;
  simulated: boolean;
  accent: string;
}

const OPTIONS: Option[] = [
  {
    value: 'chat',
    labelKey: 'checkin.channelChat',
    icon: MessageSquare,
    bestFor: 'Reading and tapping',
    style: 'Three questions, one at a time',
    simulated: false,
    accent: 'text-stream-language',
  },
  {
    value: 'voice',
    labelKey: 'checkin.channelVoice',
    icon: Mic,
    bestFor: 'Speaking rather than typing',
    style: 'Say as much or as little as you like',
    simulated: false,
    accent: 'text-stream-voice',
  },
  {
    value: 'ivrs',
    labelKey: 'checkin.channelIvrs',
    icon: Phone,
    bestFor: 'Any phone, no reading needed',
    style: 'A guided call, answered with number keys',
    simulated: true,
    accent: 'text-stream-case',
  },
  {
    value: 'sms',
    labelKey: 'checkin.channelSms',
    icon: Smartphone,
    bestFor: 'Very low connectivity',
    style: 'Reply with a single digit',
    simulated: true,
    accent: 'text-stream-engagement',
  },
];

export const ChannelChooser = ({ onChoose }: { onChoose: (channel: Channel) => void }) => {
  const { t } = useTranslation();

  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((option, index) => (
        <motion.li
          key={option.value}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
        >
          <button
            type="button"
            onClick={() => onChoose(option.value)}
            className="group h-full w-full rounded-2xl border border-line bg-paper px-5 py-5 text-left transition-all duration-300 ease-editorial hover:-translate-y-0.5 hover:border-ink-900/25 hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory-100 transition-colors group-hover:bg-sage-100">
                <option.icon aria-hidden className={`h-[18px] w-[18px] ${option.accent}`} />
              </span>
              {option.simulated ? (
                <span className="chip border-lav-200 bg-lav-200/25 text-[9.5px] uppercase tracking-[0.14em] text-lav-500">
                  {t('common.simulated')}
                </span>
              ) : null}
            </div>

            <p className="mt-4 font-display text-[23px] leading-tight text-ink-900">
              {t(option.labelKey)}
            </p>
            <p className="mt-1.5 text-[13px] text-ink-500">{option.bestFor}</p>
            <p className="mt-3 border-t border-line/70 pt-3 text-[12px] leading-relaxed text-ink-400">
              {option.style}
            </p>
          </button>
        </motion.li>
      ))}
    </ul>
  );
};
