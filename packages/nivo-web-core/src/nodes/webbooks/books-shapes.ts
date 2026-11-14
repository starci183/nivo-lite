import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"

/*
 * The shared shapes of the Accounting steps. Kept from today's `books-shapes.ts`; `MAIL_DRAFT_RULE` and the
 * `send_email` re-export are gone (the mail is `TOOL.mailMessageSend`, its payload shape is the tool's own description, never a
 * goal's sentence).
 */

/** A member of a CRM answer as text: a scalar as itself, a structure as its JSON (never `[object Object]`). */
export const jsonText = (value: JsonValue | undefined): string =>
    typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)

/** The longest id a step hands on (a uuid, a CRM code, a bank row id). */
export const ID_MAX = 100

/** The longest line a step writes for the team about one record. */
export const LINE_MAX = 400

/** The longest team message or mail body a step writes. */
export const BODY_MAX = 4000

/** The most items one round takes: the loop's own most for a page the CRM lists. */
export const ROUND_MAX = 25

/** The most results a report reads: the loop's own most, so a round's results always fit. */
export const RESULTS_MAX = 50

/** The language the team reads. */
export type TeamLocale = "vi" | "en"

/** The schema of the team's language. */
export const localeSchema: z.ZodType<TeamLocale> = z.enum(["vi", "en"])

/** The schema of an id handed on between steps. */
export const idSchema: z.ZodString = z.string().min(1).max(ID_MAX)

/** The schema of one line for the team. */
export const lineSchema: z.ZodString = z.string().min(1).max(LINE_MAX)

/** The schema of a CRM date as the CRM lists it (`YYYY-MM-DD`), or none. */
export const dateSchema: z.ZodNullable<z.ZodString> = z.string().max(10).nullable()

/** The kind of a plain team message. */
export const TEXT_KIND = "message.text"

/**
 * The refusal of a call a person declined on its approval card (a step set to `ask`: NIVO Web's only one is the invoice issue, a shop may set more): a DECISION, never a failure. A node that meets it returns (its
 * `declined` member) and a blocking node's graph tells the team (`team.declined-notice`) and ends `declined`.
 */
export const DECLINED = "declined"
