import { randomBytes } from "node:crypto"

/** The shortest stored password worth keeping; anything shorter is replaced by a fresh one. */
export const PASSWORD_MIN = 16

/** The value stored under `KEY=` in a secrets text, quotes removed; empty when the key is not there. */
export const secretOf = (text: string, key: string): string => {
    const line = text.split("\n").find((candidate) => candidate.trimStart().startsWith(`${key}=`))
    return line === undefined
        ? ""
        : line
              .slice(line.indexOf("=") + 1)
              .trim()
              .replace(/^["']|["']$/g, "")
}

/** A secrets text with `KEY=value` set: the existing line is replaced, else the line is appended. */
export const withSecret = (text: string, key: string, value: string): string => {
    const lines = text.split("\n")
    const index = lines.findIndex((candidate) => candidate.trimStart().startsWith(`${key}=`))
    if (index !== -1) return lines.map((line, at) => (at === index ? `${key}=${value}` : line)).join("\n")
    return `${text}${text !== "" && !text.endsWith("\n") ? "\n" : ""}${key}=${value}\n`
}

/** The stored password of a demo account when it is for the same email and long enough; else the freshly generated one. */
export const passwordFor = (text: string, role: string, email: string, generate: () => string): string => {
    const stored = secretOf(text, `READY_${role}_PASSWORD`)
    const sameAccount = secretOf(text, `READY_${role}_EMAIL`) === email
    return sameAccount && stored.length >= PASSWORD_MIN ? stored : generate()
}

/** A fresh strong password, 24 url-safe characters. */
export const newPassword = (): string => randomBytes(18).toString("base64url")
