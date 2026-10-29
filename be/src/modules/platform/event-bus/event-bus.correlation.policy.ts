/**
 * Accepts only bounded, header-safe identities on serialized async envelopes. This equals `isCorrelationId` of the canon's
 * platform/logging, which this back end's logging does not carry yet; swap to that import when the skeleton's logging lands.
 */
export const isCorrelationId = (value: unknown): value is string =>
    typeof value === "string" && value.length > 0 && value.length <= 128 && !/[^A-Za-z0-9._:-]/.test(value)
