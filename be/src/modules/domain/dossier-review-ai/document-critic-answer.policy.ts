import { PRODUCED_MODEL_KINDS, type CriticKind, type CritiqueFinding, type RefusedFinding } from "@modules/domain/dossier-review"
import type { DocumentCritiqueAnswer } from "./document-critic.schema"

/**
 * The kinds the model may produce, from the ONE list the core keeps (`PRODUCED_MODEL_KINDS`, today text addressed to an AI): the
 * prompt names exactly these (`document-critic-prompt.policy`) and an answer is read against exactly these, so the two cannot drift
 * apart again (D-N-2). A stored kind of old rows that the model no longer produces is refused like an unknown one.
 */
const KINDS: ReadonlyMap<string, CriticKind> = new Map(PRODUCED_MODEL_KINDS.map((kind): [string, CriticKind] => [kind, kind]))

/** The fewest characters of a line that says anything. */
const LINE_MIN = 3

/** The most quotes and values one point keeps (what the prompt asks for). */
const QUOTES_MAX = 4
const VALUES_MAX = 2

/** The longest kind kept in a refusal record. */
const KIND_SHOWN = 40

/** A kind as the model wrote it, brought to the list's spelling: lower case, spaces and hyphens as underscores. */
const kindOf = (written: string): CriticKind | null =>
    KINDS.get(
        written
            .trim()
            .toLowerCase()
            .replaceAll(/[\s-]+/gu, "_"),
    ) ?? null

/** What an answer holds once read point by point. */
export interface ReadCritique {
    /** The points that fit: a critic kind, a line, at least one quote. */
    readonly findings: ReadonlyArray<CritiqueFinding>
    /** The points left out, each with the kind it gave and why. */
    readonly refused: ReadonlyArray<RefusedFinding>
}

/**
 * Reads a parsed answer point by point (D-N-2). A point with a kind the model does not produce, with no line or with no quote is left
 * out and recorded; every other point of the answer stands. Quotes and values beyond what a point keeps are cut, never refused.
 */
export const readCritique = (answer: DocumentCritiqueAnswer): ReadCritique => {
    const findings: Array<CritiqueFinding> = []
    const refused: Array<RefusedFinding> = []
    for (const finding of answer.findings) {
        const kind = kindOf(finding.kind)
        if (kind === null) {
            refused.push({ kind: finding.kind.trim().slice(0, KIND_SHOWN), problem: "kind" })
            continue
        }
        if (finding.line.trim().length < LINE_MIN || finding.quotes.length === 0) {
            refused.push({ kind, problem: "shape" })
            continue
        }
        findings.push({ ...finding, kind, quotes: finding.quotes.slice(0, QUOTES_MAX), values: finding.values.slice(0, VALUES_MAX) })
    }
    return { findings, refused }
}

/** A text field of the structured output. */
const TEXT = { type: "string" } as const

/** The severity the prompt states (`CRITIC_SYSTEM_PROMPT`: text addressed to an AI is always high). */
const SEVERITIES = ["high"] as const

/**
 * The critique answer as the API's STRUCTURED OUTPUT (`AiChatRequest.outputSchema`): the shape the prompt states, every object
 * closed (`additionalProperties: false`), every field present, NO length or number bound (the API refuses them); the kind and the
 * severity the prompt states as closed lists are enums. The answer is still read with `DOCUMENT_CRITIQUE_SCHEMA` and point by
 * point (`readCritique`).
 */
export const DOCUMENT_CRITIQUE_OUTPUT_SCHEMA: Readonly<Record<string, unknown>> = {
    type: "object",
    properties: {
        findings: {
            type: "array",
            items: {
                type: "object",
                properties: {
                    kind: { type: "string", enum: [...PRODUCED_MODEL_KINDS] },
                    severity: { type: "string", enum: [...SEVERITIES] },
                    line: TEXT,
                    why: TEXT,
                    question: TEXT,
                    quotes: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: { key: TEXT, quote: TEXT },
                            required: ["key", "quote"],
                            additionalProperties: false,
                        },
                    },
                    values: { type: "array", items: TEXT },
                },
                required: ["kind", "severity", "line", "why", "question", "quotes", "values"],
                additionalProperties: false,
            },
        },
    },
    required: ["findings"],
    additionalProperties: false,
}
