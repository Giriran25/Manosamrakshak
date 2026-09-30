import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import {
  Parallax,
  Rise,
  ScrollStatement,
  SectionMarker,
  StaggeredStatement,
} from '@/components/common/Editorial';
import { ScrollJourney } from '@/components/landing/ScrollJourney';
import { SignalConvergence } from '@/components/risk/SignalConvergence';

/**
 * The product introduction.
 *
 * Editorial rather than promotional: asymmetric, one idea per screen, and
 * paced so that by the time a reader reaches the platform they already know
 * what the system claims and - just as importantly - what it refuses to claim.
 */

const REFUSALS = [
  {
    index: '01',
    title: 'It never acts',
    body: 'The output is a ranked queue with its reasons attached. Every intervention is proposed to a named counsellor and dispatched by that person, and the decision is recorded against their role.',
  },
  {
    index: '02',
    title: 'It admits uncertainty',
    body: 'High concern with weak evidence is routed to human review rather than fired as an alert. The queue is capped at a counsellor’s real daily capacity instead of pretending attention is unlimited.',
  },
  {
    index: '03',
    title: 'It stays out of entitlements',
    body: 'Distress signals are walled off from relief, compensation and eligibility decisions, and from investigative use. Identity is held apart and released only against a recorded justification.',
  },
];

export const LandingPage = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
    layoutEffect: false,
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const heroFade = useTransform(scrollYProgress, [0, 0.75], [1, 0.2]);

  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-ivory-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center gap-4 px-5 py-3.5 sm:px-8">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.2em] text-ink-400">ManoSamRakshak</p>
            <p className="text-[13px] text-ink-900">AI-Assisted Victim-Support Platform</p>
          </div>
          <nav className="ml-auto flex items-center gap-2">
            <Link to="/about" className="btn-ghost hidden sm:inline-flex">
              How it works
            </Link>
            <Link to="/login" className="btn-primary">
              Enter platform
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      {/*
        Hero. Asymmetric on purpose: the statement sits left against a wide
        gutter, with the four-line thesis set as a separate column so the two
        read as headline and standfirst rather than as a centred pitch.
      */}
      <section ref={heroRef} className="relative overflow-hidden px-5 pb-24 pt-32 sm:px-8 sm:pt-48">
        <div aria-hidden className="grain pointer-events-none absolute inset-0 opacity-60" />
        <motion.div
          style={reduced ? undefined : { y: heroY, opacity: heroFade }}
          className="relative mx-auto max-w-[1280px]"
        >
          <Rise>
            <p className="eyebrow">Distress prediction for victims of atrocities</p>
          </Rise>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <StaggeredStatement
              text="Don't wait for distress to become a crisis."
              className="max-w-[18ch] text-display-xl text-ink-900"
              delay={0.1}
            />

            <div className="lg:pb-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="rule mb-5 max-w-[8rem]" />
                <p className="font-display text-[20px] leading-[1.35] text-ink-700 sm:text-[23px]">
                  Understand the person.
                  <br />
                  Understand the journey.
                  <br />
                  Explain the change.
                  <br />
                  Keep the human in control.
                </p>
              </motion.div>
            </div>
          </div>

          <motion.div
            className="mt-12 flex flex-wrap items-center gap-3"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link to="/login" className="btn-primary px-6 py-3 text-[15px]">
              Enter platform
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
            <Link to="/about" className="btn-secondary px-6 py-3 text-[15px]">
              How it works
            </Link>
            <p className="w-full max-w-[46ch] text-[12.5px] leading-relaxed text-ink-400 sm:ml-4 sm:w-auto">
              A triage aid for district counsellors. Not a diagnostic instrument, and not a
              decision-maker.
            </p>
          </motion.div>
        </motion.div>
      </section>

      {/* The premise. */}
      <section className="border-t border-line bg-paper px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1280px]">
          <SectionMarker index="01" label="The premise" />
          <div className="mt-10 grid gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <ScrollStatement
              lines={['One case.', 'Many moments.', 'A changing', 'human story.']}
              className="space-y-1"
              lineClassName="text-display-md text-ink-900"
            />
            <div className="space-y-5 text-[15.5px] leading-relaxed text-ink-500">
              <Rise>
                <p>
                  For someone pursuing a case under protective legislation, the hardest moments are
                  often procedural. The immediate relief that was due within days has not arrived.
                  The accused is out on bail and living in the same ward. The hearing has been
                  adjourned for the third time, and each date has to be survived again.
                </p>
              </Rise>
              <Rise delay={0.08}>
                <p>
                  Those are not unpredictable events. They are calendar events with statutory
                  deadlines attached, which means distress driven by them can be anticipated rather
                  than discovered afterwards.
                </p>
              </Rise>
              <Rise delay={0.16}>
                <p className="text-ink-900">
                  So the system does not simply read a mood. It learns what is usual{' '}
                  <em>for that person</em>, watches how far they move from it, and reads that
                  movement against what the case is doing to them.
                </p>
              </Rise>
            </div>
          </div>
        </div>
      </section>

      {/* Scroll-driven case journey. */}
      <section className="px-5 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <ScrollJourney />
        </div>
      </section>

      {/* Four signals, one decision. */}
      <section className="border-y border-line bg-forest-900 px-5 py-20 text-ivory-50 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-[1280px]">
          <div className="flex items-center gap-3 border-t border-white/15 pt-4">
            <span className="font-mono text-[11px] text-white/35">02</span>
            <span className="text-[10.5px] uppercase tracking-[0.18em] text-white/40">
              Not sentiment analysis
            </span>
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <ScrollStatement
                lines={['Four signals.', 'One human', 'decision.']}
                className="space-y-1"
                lineClassName="text-display-md text-white"
              />
              <Rise delay={0.15}>
                <p className="mt-7 max-w-[44ch] text-[14px] leading-relaxed text-white/55">
                  Language is one of four streams, and the smallest of the passive ones. The
                  strongest predictor is the case calendar, which is also the part that can be
                  explained in a sentence a counsellor and a district officer both understand.
                </p>
              </Rise>
            </div>

            <Parallax distance={26}>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-4 py-6 sm:px-7">
                <SignalConvergence />
              </div>
            </Parallax>
          </div>
        </div>
      </section>

      {/* The refusal. */}
      <section className="px-5 py-20 sm:px-8 sm:py-32">
        <div className="mx-auto max-w-[1280px]">
          <SectionMarker index="03" label="What it will not do" />
          <div className="mt-10">
            <ScrollStatement
              lines={['AI recommends.', 'A human decides.']}
              className="space-y-1"
              lineClassName="text-display-lg text-ink-900"
            />
          </div>

          <div className="mt-14 grid gap-10 lg:grid-cols-3">
            {REFUSALS.map((item, index) => (
              <Rise key={item.title} delay={index * 0.08}>
                <div className="border-t border-line pt-6">
                  <span className="font-mono text-[11px] text-ink-300">{item.index}</span>
                  <h3 className="mt-3 font-display text-[25px] leading-tight text-ink-900">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ink-500">{item.body}</p>
                </div>
              </Rise>
            ))}
          </div>
        </div>
      </section>

      {/* Close. */}
      <section className="px-5 pb-16 sm:px-8">
        <div className="mx-auto max-w-[1280px]">
          <Rise>
            <div className="flex flex-wrap items-center gap-6 rounded-3xl border border-line bg-paper px-6 py-8 sm:px-10 sm:py-10">
              <div className="min-w-0">
                <p className="eyebrow">Prototype</p>
                <p className="mt-3 max-w-[40ch] font-display text-[27px] leading-[1.15] text-ink-900">
                  Every case in this build is synthetic. Every simulated channel says so on screen.
                </p>
              </div>
              <Link to="/login" className="btn-primary ml-auto px-7 py-3.5 text-[15px]">
                Enter platform
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </Rise>
        </div>
      </section>

      <div className="mx-auto max-w-[1280px] px-5 pb-10 sm:px-8">
        <Footer />
      </div>
    </div>
  );
};
