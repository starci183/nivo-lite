import type { Correction } from "./brain.contracts"
import { fieldsOf } from "./extraction.policy"

/** The fewest corrections worth studying together. */
export const MIN_CORRECTIONS = 3

/** The standing instructions of the lesson mining. */
export const LEARN_SYSTEM = [
    "You study how a business owner corrects an AI assistant's work, to find lessons the assistant should follow next time.",
    "Only report a pattern that appears in at least TWO corrections. Ignore one-off changes and anything about a single customer.",
    "A lesson is a short instruction the assistant can follow, specific and testable, written in the language the owner uses in the corrections.",
    "Do not repeat a lesson that already exists (EXISTING LESSONS).",
    'Reply with ONLY JSON: {"lessons": [{"title": string (max 12 words), "body": string (max 60 words), "applies_when": string (max 20 words), "decisions": string[] (the ids it is based on, at least 2)}]} with at most 5 lessons, or {"lessons": []}.',
].join("\n")

/** A lesson as the model proposes it. */
export interface ProposedLesson {
    /** The title. */
    readonly title: string
    /** What to do. */
    readonly body: string
    /** When it applies. */
    readonly appliesWhen: string
    /** The decisions it is based on. */
    readonly decisions: ReadonlyArray<string>
}

/** A text cut to `max` characters with an ellipsis. */
const clip = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 1)}…` : text)

/** What changed in one correction, as a short readable block (draft before and after, changed fields, the owner's note). */
export const describe = (correction: Correction): string => {
    const lines: Array<string> = [`Action: ${correction.action} · ${correction.outcome}`]
    const before = correction.before ?? {}
    const after = correction.after ?? {}
    if (correction.outcome === "edited" && before.draft && after.draft && before.draft !== after.draft) {
        lines.push(`AI draft: ${clip(before.draft, 600)}`, `Owner's version: ${clip(after.draft, 600)}`)
    } else if (before.draft) {
        lines.push(`AI draft: ${clip(before.draft, 600)}`)
    }
    const names = new Set([...Object.keys(before.fields ?? {}), ...Object.keys(after.fields ?? {})])
    names.forEach((name) => {
        const was = JSON.stringify((before.fields ?? {})[name] ?? null)
        const now = JSON.stringify((after.fields ?? {})[name] ?? null)
        if (was !== now) lines.push(`Field ${name}: ${clip(was, 120)} -> ${clip(now, 120)}`)
    })
    if (correction.note) lines.push(`Owner's note: ${clip(correction.note, 300)}`)
    return lines.join("\n")
}

/** The user message of the lesson mining. */
export const learnPrompt = (existing: ReadonlyArray<string>, corrections: ReadonlyArray<Correction>): string =>
    [
        `EXISTING LESSONS:\n${existing.join("\n") || "(none)"}`,
        `CORRECTIONS (newest first):\n${corrections.map((item) => `[${item.decisionId}]\n${describe(item)}`).join("\n\n")}`,
    ].join("\n\n")

/** The text of a JSON field when it is one. */
const textField = (fields: ReadonlyMap<string, unknown>, name: string): string | null => {
    const value = fields.get(name)
    return typeof value === "string" ? value : null
}

/** The lessons of a parsed model answer; an answer that is not the expected JSON gives none. */
export const parseLessons = (answer: unknown): Array<ProposedLesson> => {
    const list = fieldsOf(answer)?.get("lessons")
    if (!Array.isArray(list)) return []
    return list.flatMap((item) => {
        const fields = fieldsOf(item)
        const title = fields === null ? null : textField(fields, "title")
        const body = fields === null ? null : textField(fields, "body")
        if (fields === null || title === null || body === null) return []
        const decisions = fields.get("decisions")
        return [
            {
                title,
                body,
                appliesWhen: textField(fields, "applies_when") ?? "",
                decisions: Array.isArray(decisions)
                    ? decisions.filter((id): id is string => typeof id === "string")
                    : [],
            },
        ]
    })
}
