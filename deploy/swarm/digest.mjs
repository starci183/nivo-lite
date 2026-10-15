/** Registry image references must carry a real sha256 digest, never the all-zero placeholder. */
export const DIGEST_REF = /^[a-z0-9./_-]+(?::[A-Za-z0-9._-]+)?@sha256:(?!0{64}$)[0-9a-f]{64}$/u

/** Detects an unreplaced image digest in any service, including both web and landing, or an image reference. */
export const hasPlaceholderDigest = (bytes) => /@sha256:0{64}\b/u.test(bytes)

/** Allows local unpinned images only when they do not carry the placeholder digest. */
export const isImageReference = (value, allowUnpinned = false) =>
    Boolean(value) && !hasPlaceholderDigest(value) && (allowUnpinned || DIGEST_REF.test(value))
