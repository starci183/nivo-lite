import { redactString, redactValue } from "@modules/platform/logging"

/** The longest scope, message and stack an `app_errors` row keeps. */
export const SCOPE_MAX = 120
export const MESSAGE_MAX = 2000
export const STACK_MAX = 6000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Cuts a text to `max` characters, marking the cut. */
export const clip = (value: string, max: number): string =>
    value.length > max ? `${value.slice(0, max)}\u2026` : value

/** Clips first (bounds the work), scrubs credentials, clips again: what an `app_errors` text column receives. */
export const clean = (value: string, max: number): string => clip(redactString(clip(value, max * 2)), max)

/** The message of any failure: an Error's message, a text as is, anything else as scrubbed JSON. */
export const messageOf = (error: unknown): string => {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    return JSON.stringify(redactValue(error)) ?? String(error)
}

/** A uuid, or null for anything else: only a real id may name a workspace or a connection. */
export const uuidOrNull = (value: unknown): string | null =>
    typeof value === "string" && UUID.test(value) ? value : null
