import { createHash } from "node:crypto"

const MIN_PASSWORD_CHARACTERS = 8
const BCRYPT_MAX_BYTES = 72

/** The lower-cased, trimmed sign-in address. */
export const normalizeEmail = (email: string): string => email.trim().toLowerCase()

/** True when a new password fits the policy: at least 8 characters, at most the 72 bytes bcrypt reads. */
export const isAcceptablePassword = (password: string): boolean =>
    [...password].length >= MIN_PASSWORD_CHARACTERS && Buffer.byteLength(password, "utf8") <= BCRYPT_MAX_BYTES

/** True when a presented password can possibly match (bcrypt reads 72 bytes at most); longer input is refused before hashing. */
export const isPresentablePassword = (password: string): boolean =>
    password.length > 0 && Buffer.byteLength(password, "utf8") <= BCRYPT_MAX_BYTES

/** The SHA-256 hex of an opaque token or an address; only this form is stored or used as a counter key. */
export const digestOf = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex")
