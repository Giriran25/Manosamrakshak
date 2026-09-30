import { Eyebrow } from '@/components/common/Primitives';
import { DisclosureSection, Rise, ScrollStatement } from '@/components/common/Editorial';
import { PrivacyStory } from '@/components/admin/PrivacyStory';
import { COMPLIANCE_FRAME, ETHICAL_FIREWALL, RETENTION_COPY } from '@/data/policy';

/**
 * The privacy model as a screen of its own.
 *
 * Separate from the identity console because it is a different question: not
 * "let me see this person" but "what does this system do with what it is
 * given". Written so that a reviewer can check each claim against the build.
 */
const COMMITMENTS = [
  {
    title: 'Consent, per channel, revocable',
    body: 'Withdrawal deletes the derived features rather than hiding them: the language, voice and engagement measures taken from that person’s check-ins are cleared and the score falls back to the streams that remain. Check-ins and the helpline continue to work.',
  },
  {
    title: 'Access is scoped, not just gated',
    body: 'Role-based and district-scoped, enforced in the data layer as well as the routing, so a case from another district is never loaded into memory in the first place.',
  },
  {
    title: 'The log is deliberately thin',
    body: 'Time, role, action type, case reference, outcome. No names, no free text, no transcripts, no audio. A safety override records its category, never the sentence that triggered it.',
  },
  {
    title: 'Fairness is a measurement obligation',
    body: 'Recall reported separately by language, gender, literacy proxy and district, with a minimum per-group floor. Bias in a system serving this population would be the most serious failure available to it, so it is something to measure and publish rather than to assert.',
  },
];

export const AdminPrivacy = () => (
  <div className="space-y-12 pb-4">
    <header>
      <Rise>
        <Eyebrow>Privacy model</Eyebrow>
      </Rise>
      <div className="mt-4">
        <ScrollStatement
          lines={['Identity stays out', 'of the analytics.']}
          className="space-y-1"
          lineClassName="text-display-md text-ink-900"
        />
      </div>
      <Rise delay={0.2}>
        <p className="mt-5 max-w-[68ch] text-[15px] leading-relaxed text-ink-500">
          A system that reads distress for people who have already been harmed has to be able to
          say exactly what it holds, what it drops, and who can see the difference. These are the
          four transformations the build actually performs.
        </p>
      </Rise>
    </header>

    <DisclosureSection index="01" label="What happens to the data">
      <PrivacyStory />
    </DisclosureSection>

    <DisclosureSection
      index="02"
      label="Commitments"
      title="Four things that are enforced rather than promised"
    >
      <div className="grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2">
        {COMMITMENTS.map((item) => (
          <div key={item.title} className="bg-paper px-5 py-5">
            <h3 className="font-display text-[20px] leading-tight text-ink-900">{item.title}</h3>
            <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-500">{item.body}</p>
          </div>
        ))}
      </div>
    </DisclosureSection>

    <DisclosureSection index="03" label="Frame and retention">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-paper px-5 py-5 sm:px-6">
          <Eyebrow>Compliance frame</Eyebrow>
          <p className="mt-2 font-display text-[21px] leading-tight text-ink-900">
            {COMPLIANCE_FRAME}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-500">
            Taken as design intent for a prototype rather than as certified compliance: purpose
            limitation, notice in the person&rsquo;s own language, a right to withdraw, and breach
            notification.
          </p>
        </div>

        <div className="rounded-3xl border border-line bg-paper px-5 py-5 sm:px-6">
          <Eyebrow>Retention</Eyebrow>
          <p className="mt-2 text-[14px] leading-relaxed text-ink-700">{RETENTION_COPY}</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-400">
            The same constant drives this sentence and the one shown to the person in their own
            portal, so the two cannot drift apart.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-3xl border border-forest-700/20 bg-forest-700/[0.04] px-5 py-5 sm:px-6">
        <Eyebrow>Ethical firewall</Eyebrow>
        <p className="mt-2 max-w-[86ch] text-[14px] leading-relaxed text-ink-700">
          {ETHICAL_FIREWALL}
        </p>
      </div>
    </DisclosureSection>
  </div>
);
