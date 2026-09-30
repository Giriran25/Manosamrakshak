/**
 * Prototype engine layer.
 *
 * Every module here is pure TypeScript with no React, no clock reads and no
 * randomness - the current time is always passed in. That is what makes the
 * demo repeatable and the logic unit-testable, and it is the seam where the
 * production models described in the proposal (IndicWhisper, MuRIL/IndicBERT,
 * openSMILE eGeMAPS, a calibrated gradient-boosted risk model with conformal
 * intervals and SHAP attributions) replace the heuristics without the product
 * above changing shape.
 */
export * from './constants';
export * from './lexicon';
export * from './safety';
export * from './signals';
export * from './baseline';
export * from './trend';
export * from './caseContext';
export * from './fusion';
export * from './confidence';
export * from './explain';
export * from './followup';
export * from './normalize';
export * from './pipeline';
