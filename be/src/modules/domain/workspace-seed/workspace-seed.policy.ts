import { randomBytes } from "node:crypto"

/** A fresh strong password, 24 url-safe characters. */
export const newPassword = (): string => randomBytes(18).toString("base64url")
