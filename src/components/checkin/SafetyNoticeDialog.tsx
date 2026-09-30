import { AnimatePresence, motion } from 'framer-motion';
import { LifeBuoy } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';

/**
 * What the person sees when the deterministic safety override fires.
 *
 * Calm, not alarming, and careful about what it claims: a member of the
 * support team will be notified. It does not say an emergency service has been
 * contacted, because in this prototype none has been.
 */
export const SafetyNoticeDialog = () => {
  const notice = useAppStore((s) => s.safetyNotice);
  const dismiss = useAppStore((s) => s.dismissSafetyNotice);
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-forest-900/35 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="safety-title"
        >
          <motion.div
            className="w-full max-w-md rounded-2xl border border-line bg-paper p-6 shadow-lift"
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-sage-100">
              <LifeBuoy aria-hidden className="h-4 w-4 text-forest-700" />
            </span>
            <h2 id="safety-title" className="mt-4 text-display-sm text-ink-900">
              {t('safety.title')}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-500">{t('safety.body')}</p>
            <div className="mt-4 rounded-xl bg-ivory-100 px-4 py-3 text-[12.5px] leading-relaxed text-ink-500">
              {t('support.helpline')}: 14566
            </div>
            <button type="button" className="btn-primary mt-5 w-full" onClick={dismiss}>
              {t('safety.ack')}
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
