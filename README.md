# ManoSamRakshak

**AI-Assisted Victim-Support Platform**

Prototype for an AI-assisted victim-support platform for people navigating cases under protective legislation.

> AI prioritizes attention; a human decides the action.

---

## What this is

A monitoring and triage layer for district counsellors. It reads two things: the case-status
events a protective-legislation case already generates, and short periodic check-ins on channels
a person already uses. It produces, per case, a distress trajectory, a 14-day escalation risk, a
human-readable reason, a confidence figure, and a proposed action for a named human.

The premise is that for someone pursuing such a case, distress is largely produced by the process
itself — relief that has not arrived, the accused released on bail, hearings adjourned again — and
those are calendar events with statutory deadlines attached. So the heaviest input is the case
timeline, and language, voice and engagement corroborate it.

## What this is not

- Not a diagnosis, and not a clinical instrument. The score is a triage number for ranking a queue.
- Not autonomous. Nothing is dispatched by the system; a named counsellor decides and is recorded.
- Not an input to relief, compensation or eligibility decisions, and not for investigative use.
- Not clinically validated. The fusion weights are transparent hand-set heuristics.
- Not integrated with any government system, telecom network, or clinical service. The phone-keypad
  and text-message screens are browser simulations and are labelled as such on screen.
- The safety override routes inside the application and writes an audit entry. It does not contact
  emergency services, and the product never says that it does.
- Every case in this build is synthetic and labelled *Synthetic demo case*.

---

## Running it

```
npm install
npm run dev            # the app,  http://localhost:5173
npm run server         # the API,  http://localhost:8787   (second terminal)
```

`/api` is proxied in development, so the two need no configuration to find each
other. The app runs **without** the API server too: chat is then scored in the
browser and the badge on each channel says so.

```
npm run verify         # typecheck, lint, tests, integrity scan, production build
npm run test           # engine, integration and server tests
npm run build          # production build
```

---

## What is real, what needs credentials, what stays a fallback

| | State | Needs |
| --- | --- | --- |
| **Chat** | Real. Answers are validated, normalized, scored by the domain engine, persisted and broadcast. | Nothing. The API server makes it server-side; without it, the browser scores it. |
| **Voice capture** | Real. MediaRecorder plus an AnalyserNode measuring every 50ms frame; the five summary measures are computed from those measurements. | A microphone and permission. |
| **Voice transcription** | Real where the browser provides speech recognition, on the device. | Nothing for the browser path. `ASR_*` for a server-side service. |
| **Database** | Real writes to `interaction_events`, `signal_features` and `risk_scores`. | `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. |
| **Live dashboard** | Real. Server-sent events; a cross-tab broadcast when there is no server. | Nothing. |
| **IVRS state machine** | Real and server-side. Sessions persist across webhook calls; keypress latency is genuine elapsed time. | Nothing to drive it from the test console. |
| **IVRS carrier leg** | Available only when configured; otherwise the labelled browser test console drives the same state machine. | `TELEPHONY_*` + `DEMO_PHONE_NUMBER`. |
| **SMS** | Available only when configured; otherwise the labelled browser thread is the demo fallback. | `SMS_*` + `DEMO_PHONE_NUMBER`. |

Fallbacks, in order: **real → configured fallback → demo**. Voice falls back to a
labelled sample reading; SMS falls back to the simulated thread; IVRS falls back
to the test console, which drives the same server state machine without a
carrier. Every fallback is recorded with `isSynthetic: true` and every badge
names the state it is actually in.

### Running real voice

Nothing to configure. Sign in as `victim`, open **Check in → Voice**, press the
control and allow the microphone. The badge reads **Live voice**. What you see
afterwards is measured from your own recording — the frame count is shown — and
the recording is dropped at that point. Where the browser supports recognition,
what you said is transcribed on the device and feeds the language stream.
Chromium-based browsers provide it; Firefox does not, and the screen then says
transcription is unavailable and continues on the measures alone.

### Configuring real SMS

1. Get a number from a Twilio-compatible provider.
2. Expose the API publicly (`ngrok http 8787`) and set `PUBLIC_URL` to that
   URL exactly — the inbound signature is computed over the full URL.
3. Set `SMS_PROVIDER=twilio`, `SMS_ACCOUNT_ID`, `SMS_AUTH_SECRET`,
   `SMS_FROM_NUMBER`, and `DEMO_PHONE_NUMBER` to a test handset you control.
4. Point the number's inbound webhook at `POST {PUBLIC_URL}/api/sms/webhook`.
5. Restart the API. The badge becomes **Live SMS**.
6. On **Check in → Text message**, press *Send the check-in prompt*, then reply
   from the handset. The reply is verified, matched to `DEMO_CASE_ID`, scored,
   and appears in the counsellor queue.

An unsigned or mis-signed request is rejected with 403. A number that is not
registered is answered politely and never routed to a case. A redelivered
message is recognised by its provider message id and never recorded twice.

### Configuring real IVRS

1. Same provider and the same public URL.
2. Set `TELEPHONY_PROVIDER=twilio`, `TELEPHONY_ACCOUNT_ID`,
   `TELEPHONY_AUTH_SECRET`, `TELEPHONY_FROM_NUMBER`, `DEMO_PHONE_NUMBER`.
   Set `TELEPHONY_SPEECH_ENABLED=true` only if the account really is configured
   for speech input — the product does not offer it otherwise.
3. For inbound calls, point the number's voice webhook at
   `POST {PUBLIC_URL}/api/ivrs/voice`.
4. Restart the API. The badge becomes **Live IVRS** and the console's keypad is
   disabled, because a real caller uses their own.
5. Press *Place a real test call*. Nothing is claimed until the provider returns
   a call id; the console then observes the live session.

### Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness and connected dashboard count |
| GET | `/api/capabilities` | What is configured. Booleans and provider names only |
| POST | `/api/interactions` | Chat and voice ingest. Honours `Idempotency-Key` |
| GET | `/api/cases/:caseId` | Current server-side assessment for one case |
| GET | `/api/events` | Server-sent live activity stream |
| POST | `/api/sms/webhook` | Inbound SMS. Signature verified |
| POST | `/api/sms/send` | Sends the check-in prompt to the registered handset |
| POST | `/api/ivrs/voice` | Call webhook. Advances the state machine, returns markup |
| GET | `/api/ivrs/session` | Call state, for the console to observe |
| POST | `/api/ivrs/console` | Starts a console-driven call. Disabled once telephony is live |
| POST | `/api/ivrs/call` | Places a real outbound test call |
| POST | `/api/voice/transcribe` | Optional server-side transcription |

Webhooks verify signatures, validate payloads, are rate limited per address,
and never log a phone number, a message body, a transcript or a credential.

### Demo mode and live mode

A switch in the header, visible at all times. **Demo** keeps the deterministic
seeded cases and the fallback channels. **Live** routes every check-in through
the API, persists where a database is configured, and updates the dashboard as
check-ins arrive. **VC-2291 is protected in both**: live interactions against it
are recorded but its scripted assessment is computed from the synthetic
interactions only, so it holds 88 / High / Deteriorating / 91%. Tests assert it.

## The demo, in 5 to 7 minutes

The demo clock is fixed at **14 April 2026** so the scenario, the queue order and the charts are
identical on every run. Presenter controls live in the staff sidebar: **Load demo case**,
**Next check-in**, **Reset demo**.

1. **Landing** - the hero statement, then the scroll-driven case journey, the four streams
   converging on one number, and the three things the system refuses to do.
2. Sign in as `victim`.
3. **Victim home** - "How have things been lately?", the next check-in, well-being direction in
   words, the case journey. No score is ever shown to the person.
4. **Check-in** - choose a channel from four designed cards, not a tab bar.
5. **Chat** - three questions as a short conversation, then *Listening...*, then
   *Analysing your check-in...*, then a supportive reply.
6. The **pipeline trace** and **normalized interaction record** at the end of the flow - the same
   record all four channels produce.
7. **My trend** - the personal baseline moving from `2 of 3` to established after that check-in.
8. Sign in as `counsellor`.
9. **Overview** - district figures, today's three cases, procedural pressure.
10. **Priority queue** - the capacity cap made visible, and what the ranking uses.
11. Open **VC-2291**. Current signal **88**, baseline **40**, deviation **+48**, confidence **91%**.
12. **Trajectory** `35 -> 41 -> 48 -> 61 -> 73 -> 83 -> 88`, with the baseline band, the change
    point, and the case-event strip: select *Accused released on bail* to draw it against the
    reading beside it.
13. **Case journey** - relief overdue and an accused at liberty as standing conditions, the bail
    hearing in 4 days as an anticipated stressor.
14. **Signals** - the four streams converging, then the weighted breakdown.
15. **Why this case is moving up the queue** - the ranked factors, entering one at a time.
16. **Confidence** 91%, and the contrast with **VC-1004**: high concern, low confidence, therefore
    *Human review required* rather than an alert.
17. **Confirm** - the decision sequence plays out: concern confirmed, follow-up tightened to
    *Within 48 hours*, action logged.
18. Back to the victim portal for the **simulated phone call** (connecting, prompts, keypad, state
    machine) and the **simulated text thread** (send states, message timing).
19. **Safety override** - type an explicit crisis statement into a chat check-in's free-text box; it
    bypasses scoring, routes to human review, and writes an audit entry recording the category only.
20. Sign in as `admin` - **Identity** protected by default, the minimum-necessary matrix, then a
    release against a stated purpose and written justification with a five-minute countdown ring.
21. **Privacy** - the four transformations the build performs, and **Audit** - every sensitive
    action, with no personal data in it.

**VC-2291 is frozen.** *Next check-in* advances it in time while holding 88 / High / Deteriorating /
91% confidence, and live channel interactions are recorded against the victim demo case `VC-3007`,
so nothing performed on stage can disturb the prepared scenario. Unit tests assert this.

## Architecture

```
src/
  engines/     pure TypeScript, no React, no clock reads, no randomness
  data/        deterministic demo scenario, fixed seed, fixed demo clock
  services/    repository boundary: demo or Supabase, demo as the fallback
  store/       one zustand store; every mutation recomputes assessments
  components/
    common/    primitives plus the editorial composition pieces
    landing/   the scroll-driven case journey
    checkin/   channel chooser, chat, voice, IVRS call, SMS thread
    counsellor/ summary figures and the operational queue table
    case/      journey track, case timeline, counsellor action panel
    risk/      badges, confidence, breakdown, signal convergence
    charts/    trajectory, sparklines, distribution
    about/     journey ribbon, animated architecture flow
    admin/     the privacy story
  pages/       landing, login, victim portal, counsellor, admin, about
  i18n/        English UI copy source
  types/       the entities the SQL schema mirrors
```

### Routes

| Route | Role | What it is |
| --- | --- | --- |
| `/` | public | Product introduction |
| `/login` | public | Demo sign-in |
| `/about` | public | How it works |
| `/victim`, `/victim/check-in`, `/victim/trend`, `/victim/case`, `/victim/support` | victim | The support portal |
| `/counsellor` | counsellor | Overview |
| `/counsellor/queue` | counsellor | Today's priority queue, capped |
| `/counsellor/cases` | counsellor | The district record, filterable |
| `/counsellor/followups` | counsellor | Follow-ups by due date |
| `/counsellor/case/:caseId` | counsellor, admin | Case detail |
| `/admin/identity` | admin | Identity custody |
| `/admin/audit` | admin, counsellor | Audit log |
| `/admin/privacy` | admin | The privacy model |
| `/admin/system` | admin | Architecture, configuration, scope |

### The engine layer

Every module in [src/engines/](src/engines/) is pure: the current time is passed in, nothing calls
`Math.random()`, and each has a comment separating the prototype heuristic from the production
direction. That is what makes the demo repeatable and the logic testable, and it is the seam where
real models replace the heuristics without the product above changing shape.

| Module              | What it does                                                                    |
| ------------------- | ------------------------------------------------------------------------------- |
| `signals.ts`        | language, engagement and within-person voice features                           |
| `safety.ts`         | deterministic crisis override with negation guards                              |
| `baseline.ts`       | personal baseline from the first three check-ins, plus deviation                |
| `trend.ts`          | slope, persistence, CUSUM change point, six trend states                        |
| `caseContext.ts`    | Stream A: event weights, time decay, standing conditions, anticipation          |
| `fusion.ts`         | weighted fusion with weight redistribution; voice can never set the band alone  |
| `confidence.ts`     | history, signal completeness, cross-signal agreement                            |
| `explain.ts`        | ranked factors and the recommendation gate                                      |
| `followup.ts`       | adaptive cadence rules                                                          |
| `normalize.ts`      | the boundary where all four channels become one record                          |
| `pipeline.ts`       | orchestration and alert-budget ranking                                          |

### Fusion weights

| Stream                | Weight |
| --------------------- | ------ |
| Case context          | 25%    |
| Baseline deviation    | 25%    |
| Longitudinal trend    | 20%    |
| Language              | 15%    |
| Engagement            | 10%    |
| Voice                 | 5%     |

Bands: 0–29 stable, 30–49 watch, 50–69 elevated, 70–100 high. When a stream is unavailable its
weight is redistributed across those present, so the breakdown always accounts for the whole score.

### Two deviations, deliberately

The fusion stream uses the deviation of the raw *observation* from the personal baseline, which
keeps the score free of circular dependence on itself. The figure reported to the counsellor is
the deviation of the *score* from the baseline, because that is the quantity shown beside it on
screen. Both are documented in [src/engines/pipeline.ts](src/engines/pipeline.ts).

---

## Privacy and security

- Pseudonymous case references everywhere in the analytics path. No case record carries a name.
- Identity lives in a separate vault, released field by field, partially masked, against a stated
  purpose and a written justification, for five minutes, with the release recorded.
- Raw audio is analysed in the browser and discarded at extraction. Only five summary measures are
  kept, and playback is unavailable because there is nothing left to replay.
- Consent is per channel and revocable. Withdrawal *deletes* the derived features rather than
  hiding them, and degrades to structured check-ins plus the helpline. Unit-tested.
- District scoping is enforced in the repository as well as in the route guards, so out-of-district
  cases are never loaded.
- The audit log carries purpose codes and outcomes only: no names, no free text, no transcripts, no
  audio. A safety override records its category, never the sentence that triggered it.
- `localStorage` holds the session and demo mode only. No tokens, no secrets, no PII.
- Compliance frame: the Digital Personal Data Protection Act, 2023, taken as design intent for a
  prototype rather than as certified compliance.

## Data sources, stated plainly

The cases are synthetic; the individuals do not exist. What is authentic is the temporal structure:
the event calendar follows the statutory deadlines that drive a real case, so the shape of the
stressor timeline is realistic even though the person is invented. Public stress-language corpora
would serve only as a *general stress-language benchmark*; no public dataset used anywhere in this
work contains data about victims of atrocities, and none is described that way.

## Accessibility

Keyboard-navigable throughout with visible focus rings, real `button` and `table` semantics,
`aria-live` on the empathy reply and the action toasts, a data table behind every chart, colour
never used as the only carrier of meaning, and `prefers-reduced-motion` honoured globally.

## Known limitations

- The Supabase repository is a guarded stub: with configuration present it logs and falls through
  to the deterministic dataset. The schema documents the shape it expects.
- Hindi and Kannada cover the victim-facing surface, navigation and shared controls. Staff
  technical vocabulary stays in English rather than being machine-translated, and falls back
  through the provider.
- Voice features are simple time-domain measures, not the eGeMAPS set a production build would use.
- The filler cohort is generated from a fixed seed and calibrated once at module load, so its
  sparklines join up with its scores but its cases carry no narrative.
