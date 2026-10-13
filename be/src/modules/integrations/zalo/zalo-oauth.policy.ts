import { createHash, randomBytes } from "node:crypto"

/** A fresh PKCE code verifier: 48 random bytes, base64url. */
export const newVerifier = (): string => randomBytes(48).toString("base64url")

/** The S256 challenge of a verifier: base64url(sha256(verifier)). */
export const challengeOf = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url")
