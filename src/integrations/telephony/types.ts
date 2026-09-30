import type { Digit, Prompt } from './stateMachine';

/**
 * Telephony provider abstraction.
 *
 * A provider turns the state machine's prompts into whatever markup it speaks,
 * reports the digits it collected, and verifies that a webhook really came
 * from it. Nothing above this interface knows which provider is in use.
 */

export interface InboundCall {
  providerCallId: string;
  from: string;
  to: string;
  /** The digit the caller pressed on this request, if any. */
  digit: Digit | null;
  /** Speech result, only when the provider is configured for it. */
  speech: string | null;
  receivedAt: string;
}

export interface PlacedCall {
  ok: boolean;
  providerCallId: string | null;
  error?: string;
}

export interface WebhookVerification {
  ok: boolean;
  reason?: string;
}

export interface TelephonyProvider {
  readonly name: string;
  readonly configured: boolean;
  /** True only when the provider is configured to return speech, not just digits. */
  readonly supportsSpeech: boolean;
  readonly inboundNumber: string | null;
  /** Places an outbound call that will be answered by the voice webhook. */
  startCall(input: { to: string; answerUrl: string }): Promise<PlacedCall>;
  verifyWebhook(input: {
    rawBody: string;
    headers: Record<string, string | string[] | undefined>;
    url: string;
    params: Record<string, string>;
  }): WebhookVerification;
  parseWebhook(params: Record<string, string>): InboundCall | null;
  /**
   * Renders the prompt into provider markup: speak the line, then either
   * gather a digit or hang up.
   */
  renderPrompt(input: {
    prompt: Prompt;
    actionUrl: string;
  }): { contentType: string; body: string };
}
