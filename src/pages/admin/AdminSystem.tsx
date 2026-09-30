import { Eyebrow } from '@/components/common/Primitives';
import { DisclosureSection, Rise } from '@/components/common/Editorial';
import { ArchitectureFlow } from '@/components/about/ArchitectureFlow';
import { SignalConvergence } from '@/components/risk/SignalConvergence';
import { dataSourceLabel } from '@/services/repository';
import { DEMO_CLOCK, useAppStore } from '@/store/useAppStore';
import { ALERT_BUDGET, BASELINE_MIN_INTERACTIONS, FUSION_WEIGHTS } from '@/engines/constants';
import { CONTRIBUTION_LABELS } from '@/engines/fusion';
import { formatDate } from '@/lib/format';

/**
 * System information for an administrator.
 *
 * The architecture, the live configuration, and the honest scope. Kept on the
 * admin side because it is the screen a reviewer asks for when they want to
 * know what is actually running rather than what is claimed.
 */
export const AdminSystem = () => {
  const cases = useAppStore((s) => s.cases);
  const interactions = useAppStore((s) => s.interactions);
  const audit = useAppStore((s) => s.audit);

  const weights = Object.entries(FUSION_WEIGHTS) as Array<[keyof typeof FUSION_WEIGHTS, number]>;

  const configuration: Array<[string, string]> = [
    ['Data source', dataSourceLabel()],
    ['Demo clock', formatDate(DEMO_CLOCK)],
    ['Cases loaded', String(cases.length)],
    ['Interactions on record', String(interactions.length)],
    ['Audit entries this session', String(audit.length)],
    ['Review capacity per day', String(ALERT_BUDGET)],
    ['Check-ins to establish a baseline', String(BASELINE_MIN_INTERACTIONS)],
    ['External model calls', 'none'],
  ];

  return (
    <div className="space-y-12 pb-4">
      <header>
        <Rise>
          <Eyebrow>System</Eyebrow>
          <h1 className="mt-2 max-w-[26ch] text-display-md text-ink-900">
            What is actually running
          </h1>
          <p className="mt-3 max-w-[66ch] text-[15px] leading-relaxed text-ink-500">
            The processing path, the live configuration, and the limits. Every computation happens
            locally and deterministically; nothing is sent to an external model.
          </p>
        </Rise>
      </header>

      <DisclosureSection
        index="01"
        label="Architecture"
        title="Four channels, one record, one decision point"
      >
        <div className="rounded-3xl border border-line bg-paper px-4 py-6 sm:px-7">
          <ArchitectureFlow />
        </div>
      </DisclosureSection>

      <DisclosureSection
        index="02"
        label="Fusion"
        title="The weights, on the table"
        description="Transparent prototype heuristics, hand-set so the behaviour is explainable and repeatable. Not clinically validated and not calibrated against outcome data."
      >
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-3xl border border-line bg-paper px-5 py-5">
            <ul className="divide-y divide-line">
              {weights.map(([key, weight]) => (
                <li key={key} className="flex items-baseline justify-between gap-4 py-2.5">
                  <span className="text-[14px] text-ink-700">{CONTRIBUTION_LABELS[key]}</span>
                  <span className="font-mono text-[13px] tabular-nums text-ink-900">{weight}%</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11.5px] leading-relaxed text-ink-400">
              Bands: 0&ndash;29 stable, 30&ndash;49 watch, 50&ndash;69 elevated, 70&ndash;100 high.
              An unavailable stream has its weight redistributed across the rest.
            </p>
          </div>
          <div className="rounded-3xl border border-line bg-paper px-4 py-6 sm:px-6">
            <SignalConvergence />
          </div>
        </div>
      </DisclosureSection>

      <DisclosureSection index="03" label="Configuration">
        <dl className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {configuration.map(([label, value]) => (
            <div key={label} className="bg-paper px-4 py-4">
              <dt className="text-[10.5px] uppercase tracking-[0.12em] text-ink-400">{label}</dt>
              <dd className="mt-1.5 font-mono text-[14px] text-ink-900">{value}</dd>
            </div>
          ))}
        </dl>
      </DisclosureSection>

      <DisclosureSection index="04" label="Scope" title="What this build does not do">
        <ul className="max-w-[76ch] space-y-2.5 text-[14px] leading-relaxed text-ink-600">
          {[
            'It does not diagnose, and nothing in it is a clinical instrument or a measure of illness.',
            'It has no government, telecom or clinical integration. The phone-keypad and text-message screens are browser simulations and say so at all times.',
            'It does not contact emergency services. The safety override routes inside the application and writes an audit entry; a real deployment needs a verified round-the-clock human responder behind that path first.',
            'It does not decide anything: no relief, no compensation, no eligibility, no protection order, no medical decision.',
            'It is not clinically validated and its weights are not calibrated against outcomes.',
            'The identity-release console is a policy simulation, not a real authorization system.',
            'Every case in the build is synthetic, and no public dataset used anywhere in this work contains data about victims of atrocities.',
          ].map((line) => (
            <li key={line} className="flex gap-3">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-300" />
              {line}
            </li>
          ))}
        </ul>
      </DisclosureSection>
    </div>
  );
};
