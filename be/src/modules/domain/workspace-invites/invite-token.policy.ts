import { createHash } from "node:crypto"

/** The hex SHA-256 of the raw invitation token: the only form the table stores. */
export const hashInviteToken = (token: string): string => createHash("sha256").update(token, "utf8").digest("hex")
