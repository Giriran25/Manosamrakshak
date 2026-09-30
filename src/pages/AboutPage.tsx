import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Footer } from '@/components/layout/Footer';
import { Eyebrow } from '@/components/common/Primitives';
import {
  Parallax,
  Rise,
  ScrollStatement,
  SectionMarker,
} from '@/components/common/Editorial';
import { ArchitectureFlow } from '@/components/about/ArchitectureFlow';
import { JourneyRibbon } from '@/components/about/JourneyRibbon';
import { SignalConvergence } from '@/components/risk/SignalConvergence';
import { ALERT_BUDGET, BASELINE_MIN_INTERACTIONS, FUSION_WEIGHTS } from '@/engines/constants';
import { CONTRIBUTION_LABELS } from '@/engines/fusion';
import { COMPLIANCE_FRAME, ETHICAL_FIREWALL, RETENTION_COPY } from '@/data/policy';
import { useAppStore } from '@/store/useAppStore';

/**
 * How it works.
 *
 * Written to be read in order and to be honest in the same breath as it
 * explains. The four statements that open it are the whole product; everything
 * after is the evidence that the build actually does what they say.
 */

const DIFFERENTIATORS = [
  {
    title: 'Personalized',
    body: `Scoring is a within-person comparison. A baseline is fixed from this person's first ${BASELINE_MIN_INTERACTIONS} check-ins and deliberately does not follow them upward during a deterioration, because a drifting baseline would hide exactly the change worth seeing.`,
  },
  {
    title: 'Longitudinal',
    body: 'Direction, repetition and a sustained shift, rather than a single difficult answer. A change point marks where the drift began.',
  },
  {
    title: 'Case-aware',
    body: 'The case calendar is the heaviest stream. Relief that has not arrived and an accused released on bail are standing conditions; a scheduled hearing raises risk before the date, not after it.',
  },
  {
    title: 'Multimodal',
    body: 'Language, voice and engagement corroborate the case signal. Voice is read only against the person’s own earlier recordings and can never set the band alone.',
  },
  {
    title: 'Explainable',
    body: 'Every flagged case states its reasons in the numbers the engine computed, with the weighted contribution of each stream shown beside the score.',
  },
  {
    title: 'Confidence-aware',
    body: 'High concern resting on thin evidence is routed to human review instead of being fired as an alert, so attention is not spent on cases the system cannot support.',
  },
  {
    title: 'Human-in-the-loop',
    body: `The queue is ranked and then capped at ${ALERT_BUDGET} cases a day. Nothing is dispatched by the system; a named counsellor confirms, dismisses or escalates and is recorded as having done so.`,
  },
  {
    title: 'Privacy-first',
    body: 'Pseudonymous case references throughout, identity in a separate vault released field by field against a written justification, raw audio discarded at extraction, revocable consent that actually deletes derived features.',
  },
];

const DATA_SOURCES = [
  {
    title: 'The cases in this build',
    body: 'All synthetic, and labelled as such on screen. The individuals do not exist. What is authentic is the temporal structure: the event calendar follows the statutory deadlines that drive a real case, so the shape of the stressor timeline is realistic even though the person is invented.',
  },
  {
    title: 'The language and voice models',
    body: 'Public corpora would serve only as a general stress-language benchmark, and public speech corpora as a general affective benchmark. No public dataset used anywhere in this work contains data about victims of atrocities, and none is described that way.',
  },
  {
    title: 'What a pilot would add',
    body: 'A short validated instrument administered periodically as ground truth, and counsellor-confirmed outcomes fed back as labels. That is what would replace the synthetic layer and turn these heuristics into a calibrated model.',
  },
];

export const AboutPage = () => {
  const session = useAppStore((s) => s.session);
  const home = session
    ? session.role === 'victim'
      ? '/victim'
      : session.role === 'admin'
        ? '/admin/identity'
        : '/counsellor'
    : '/';

  const weights = Object.entries(FUSION_WEIGHTS) as Array<[keyof typeof FUSION_WEIGHTS, number]>;

  return (
    <div className="min-h-screen bg-ivory-50">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-ivory-50/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1160px] items-center gap-4 px-5 py-3.5 sm:px-8">
          <Link to={home} className="text-[10.5px] uppercase tracking-[0.2em] text-ink-400">
            ManoSamRakshak
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <Link to={home} className="btn-secondary">
              {session ? 'Back to the platform' : 'Home'}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
        {/* The four statements. */}
        <section>
          <Rise>
            <Eyebrow>How it works</Eyebrow>
          </Rise>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
            <ScrollStatement
              lines={[
                'The case changes.',
                'The person changes.',
                'The system notices.',
                'The counsellor decides.',
              ]}
              className="space-y-1"
              lineClassName="text-display-md text-ink-900"
            />
            <Rise delay={0.25}>
              <div className="lg:pb-3">
                <div className="rule mb-5 max-w-[7rem]" />
                <p className="max-w-[46ch] text-[15.5px] leading-relaxed text-ink-500">
                  A monitoring and triage layer for district counsellors supporting victims of
                  atrocities. It does not create a new reporting channel and it does not ask for new
                  categories of information. It reads what the case process is already doing to a
                  person, and what that person says in a short periodic check-in.
                </p>
              </div>
            </Rise>
          </div>
        </section>

        {/* Why it matters. */}
        <section className="mt-24">
          <SectionMarker index="01" label="Why it matters" />
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <Rise>
              <p className="text-[15.5px] leading-relaxed text-ink-600">
                For someone pursuing a case under protective legislation, the hardest moments are
                often procedural. The immediate relief that was due within days has not come. The
                accused is out on bail and lives in the same ward. The hearing has been adjourned
                for the third time, and each date has to be survived again. A witness is told to
                withdraw.
              </p>
            </Rise>
            <Rise delay={0.1}>
              <p className="text-[15.5px] leading-relaxed text-ink-600">
                Those are not unpredictable events. They are calendar events with statutory
                deadlines attached, which means distress driven by them can be anticipated rather
                than discovered afterwards. That is the premise of this system, and the reason its
                heaviest input is the case timeline rather than the wording of a message.
              </p>
            </Rise>
          </div>
        </section>

        {/* One case, as it moves. */}
        <section className="mt-24">
          <SectionMarker index="02" label="One case, as it moves" />
          <Rise delay={0.05}>
            <h2 className="mt-4 max-w-[26ch] text-display-sm text-ink-900">
              Every moment on the timeline changes what the next check-in means.
            </h2>
          </Rise>
          <div className="mt-8">
            <JourneyRibbon />
          </div>
        </section>

        {/* Four signals. */}
        <section className="mt-24">
          <SectionMarker index="03" label="Four signals" />
          <div className="mt-8 grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <Rise>
              <h2 className="max-w-[18ch] text-display-sm text-ink-900">
                Weighted, then combined into one number.
              </h2>
              <p className="mt-4 max-w-[44ch] text-[14.5px] leading-relaxed text-ink-500">
                Language is one of four streams and the smallest of the passive ones. The strongest
                predictor is the case calendar, which is also the part that can be explained in a
                sentence a counsellor and a district officer both understand.
              </p>
            </Rise>
            <Parallax distance={22}>
              <div className="rounded-3xl border border-line bg-paper px-4 py-6 sm:px-7">
                <SignalConvergence />
              </div>
            </Parallax>
          </div>
        </section>

        {/* The pipeline. */}
        <section className="mt-24">
          <SectionMarker index="04" label="The pipeline" />
          <Rise delay={0.05}>
            <h2 className="mt-4 text-display-sm text-ink-900">From a check-in to a decision</h2>
          </Rise>
          <Rise delay={0.1}>
            <div className="mt-8 rounded-3xl border border-line bg-paper px-4 py-6 sm:px-7">
              <ArchitectureFlow />
            </div>
          </Rise>
        </section>

        {/* What the number is. */}
        <section className="mt-24">
          <SectionMarker index="05" label="What the number is" />
          <Rise delay={0.05}>
            <h2 className="mt-4 max-w-[28ch] text-display-sm text-ink-900">
              A triage signal with its weights on the table.
            </h2>
          </Rise>
          <div className="mt-8 grid gap-10 lg:grid-cols-2">
            <Rise>
              <ul className="divide-y divide-line">
                {weights.map(([key, weight]) => (
                  <li key={key} className="flex items-baseline justify-between gap-4 py-2.5">
                    <span className="text-[14px] text-ink-700">{CONTRIBUTION_LABELS[key]}</span>
                    <span className="font-mono text-[13px] tabular-nums text-ink-900">
                      {weight}%
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] leading-relaxed text-ink-400">
                Bands: 0&ndash;29 stable, 30&ndash;49 watch, 50&ndash;69 elevated, 70&ndash;100
                high. When a stream is unavailable its weight is redistributed across the streams
                that are present, so the breakdown always accounts for the whole score.
              </p>
            </Rise>
            <Rise delay={0.1}>
              <div className="space-y-4 text-[14.5px] leading-relaxed text-ink-600">
                <p>
                  These are transparent prototype heuristics, hand-set so that the behaviour is
                  explainable and repeatable. They are not clinically validated and they are not
                  calibrated against outcome data.
                </p>
                <p>
                  In production the honest version of this number is a calibrated probability
                  against a declared label: a meaningful rise on a validated instrument, or a
                  counsellor-confirmed escalation within fourteen days. A conformal predictor would
                  supply the interval that the confidence meter stands in for here, and SHAP
                  attributions would replace the fixed weight table.
                </p>
                <p className="text-ink-900">
                  Until then the product is careful about what it claims: a triage aid that ranks a
                  queue and explains itself, not a measurement of anyone&rsquo;s mental health.
                </p>
              </div>
            </Rise>
          </div>
        </section>

        {/* Differentiators. */}
        <section className="mt-24">
          <SectionMarker index="06" label="What makes it different" />
          <div className="mt-8 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {DIFFERENTIATORS.map((item, index) => (
              <Rise key={item.title} delay={index * 0.04}>
                <div className="h-full bg-paper px-5 py-5">
                  <h3 className="font-display text-[20px] leading-tight text-ink-900">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{item.body}</p>
                </div>
              </Rise>
            ))}
          </div>
        </section>

        {/* Data sources. */}
        <section className="mt-24">
          <SectionMarker index="07" label="Where the data comes from" />
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            {DATA_SOURCES.map((item, index) => (
              <Rise key={item.title} delay={index * 0.06}>
                <div className="border-t border-line pt-5">
                  <h3 className="font-display text-[20px] leading-tight text-ink-900">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-500">{item.body}</p>
                </div>
              </Rise>
            ))}
          </div>
        </section>

        {/* Privacy and ethics. */}
        <section className="mt-24">
          <SectionMarker index="08" label="Privacy and ethics" />
          <Rise delay={0.05}>
            <div className="mt-8 rounded-3xl border border-line bg-paper px-5 py-6 sm:px-7">
              <p className="max-w-[76ch] text-[15px] leading-relaxed text-ink-700">
                {ETHICAL_FIREWALL}
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  `Compliance frame: the ${COMPLIANCE_FRAME}, taken as design intent for this prototype rather than as certified compliance. Purpose limitation, notice in the person's own language, a right to withdraw, and breach notification.`,
                  'Consent is captured per channel and is revocable. Withdrawal deletes the derived features rather than hiding them, and degrades to structured check-ins plus the helpline.',
                  'Raw audio is analysed in the browser and discarded at the point of extraction. Only summary measures are retained, and playback is unavailable because there is nothing left to replay.',
                  'Identity lives in a separate vault. Release is field by field against a stated purpose and written justification, partial rather than complete, time-limited and recorded.',
                  'Access is role-based and district-scoped, enforced in the data layer as well as the routing, so out-of-district cases are never loaded.',
                  RETENTION_COPY,
                  'The audit log holds no names, no free text, no transcripts and no audio. A safety override records its category, never the sentence that triggered it.',
                  'Fairness is a measurement obligation, not a claim: recall reported separately by language, gender, literacy proxy and district, with a minimum per-group floor.',
                ].map((line) => (
                  <li
                    key={line}
                    className="rounded-2xl bg-ivory-100/70 px-4 py-3 text-[13px] leading-relaxed text-ink-600"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          </Rise>
        </section>

        {/* Scope. */}
        <section className="mt-24">
          <SectionMarker index="09" label="What this build does not do" />
          <Rise delay={0.05}>
            <ul className="mt-6 max-w-[76ch] space-y-2.5 text-[14.5px] leading-relaxed text-ink-600">
              {[
                'It does not diagnose, and nothing in it is a clinical instrument or a measure of illness.',
                'It has no government, telecom or clinical integration. The phone-keypad and text-message screens are browser simulations and say so at all times.',
                'It does not contact emergency services. The safety override routes inside the application and writes an audit entry; a real deployment needs a verified round-the-clock human responder behind that path first.',
                'It does not decide anything. No relief, no compensation, no eligibility, no protection order, no medical decision.',
                'It is not clinically validated and its weights are not calibrated against outcomes.',
                'The identity-release console is a policy simulation, not a real authorization system.',
              ].map((line) => (
                <li key={line} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-300" />
                  {line}
                </li>
              ))}
            </ul>
          </Rise>
        </section>

        {/* Team. */}
        <section className="mt-24">
          <Rise>
            <div className="rounded-3xl border border-line bg-paper px-6 py-9 sm:px-10">
              <Eyebrow>Team</Eyebrow>
              <p className="mt-3 font-display text-[34px] leading-none text-ink-900">ManoSamRakshak</p>
              <p className="mt-3 text-[14.5px] text-ink-500">
                AI-Assisted Victim-Support Platform
              </p>
              {/* Individual team member details are intentionally not invented here. */}
              <p className="mt-4 max-w-[62ch] text-[12.5px] leading-relaxed text-ink-400">
                Team member details are not listed in this build. Add them to this page rather than
                letting the prototype assert anything about who worked on it.
              </p>
              <Link to={home} className="btn-primary mt-7">
                {session ? 'Back to the platform' : 'Enter platform'}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </div>
          </Rise>
        </section>

        <Footer />
      </main>
    </div>
  );
};
