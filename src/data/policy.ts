/**
 * Policy constants that are quoted in more than one place. Keeping them here
 * means the privacy copy on the victim portal and the statement on the About
 * page cannot drift apart from each other.
 */

export const RETENTION_MONTHS_AFTER_CLOSURE = 12;

export const RETENTION_COPY = `Measures taken from your check-ins are kept for ${RETENTION_MONTHS_AFTER_CLOSURE} months after your case closes, and are then deleted.`;

export const IDENTITY_ACCESS_MINUTES = 5;

export const COMPLIANCE_FRAME = 'Digital Personal Data Protection Act, 2023';

export const ETHICAL_FIREWALL =
  'Distress signals are walled off from relief, compensation and eligibility determinations, and from investigative use. Access is role-based, district-scoped and audit-logged.';
