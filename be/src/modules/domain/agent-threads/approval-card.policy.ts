import { z, type ZodType } from "zod"
import {
    APPROVAL_TEXT_MAX,
    approvalDecisionCard,
    coreAgentMessageKinds,
    type AgentMessageKind,
    type AgentMessagePreview,
    type ApprovalDecisionCall,
    type ApprovalDecisionCard,
    type ApprovalDecisionStep,
    type MessageFact,
} from "@nivo-lite/agent-sdk/team-chat"

/** The longest text of the card (its brief), as the agent-sdk `approval.decision` text holds it. */
export const CARD_TEXT_MAX = APPROVAL_TEXT_MAX

/** The longest name or value of one fact of the card (agent-sdk `messageFactSchema`). */
const FACT_NAME_MAX = 80
const FACT_VALUE_MAX = 400

/** The step that asks, in the team's words (agent-sdk `approval.decision` `step`). */
export type ApprovalCardStep = ApprovalDecisionStep

/** The call asked for (agent-sdk `approval.decision` `call`). */
export type ApprovalCardCall = ApprovalDecisionCall

/** One fact of the card, worded by code from the call's REAL arguments. */
export type ApprovalCardFact = MessageFact

/** A package's preview of the call: a message kind a package registered, and its payload (checked against that kind's schema). */
export type ApprovalCardPreview = AgentMessagePreview

/**
 * The approval card the ENGINE builds before a write under `ask` runs (owner chốt 2026-11-13, nivo-frame `team-chat` rule 9): the
 * agent-sdk `approval.decision` card (step, call, facts from the real arguments, the brief in words, a package's preview when a valid
 * one was given).
 */
export type ApprovalCard = ApprovalDecisionCard

/** The shape the card is kept in on its stop (`run_stops.detail.approvalCard`): the agent-sdk card schema. */
export const APPROVAL_CARD_SHAPE: ZodType<ApprovalCard> = approvalDecisionCard

/** The ids of the core's own kinds: never a package's preview (only the core approval kind carries the verdict buttons). */
const CORE_KIND_IDS: ReadonlySet<string> = new Set(coreAgentMessageKinds.map((kind) => kind.id))

/**
 * The facts of a call, worded by code from its real arguments (the tools' `callWordsOf`: bounded names and values, never an AI's
 * words), bounded to the card's sizes.
 */
export const approvalFactsOf = (words: ReadonlyArray<ApprovalCardFact>): ReadonlyArray<ApprovalCardFact> =>
    words.map((word) => ({
        name: word.name.slice(0, FACT_NAME_MAX),
        value: word.value.slice(0, FACT_VALUE_MAX),
    }))

/** The content a person approves, kept in full on the card (agent-sdk `approval.decision` `content`). */
export type ApprovalCardContent = NonNullable<ApprovalDecisionCard["content"]>

/** The shape of the content the door's approval error carries (JSON text, read back): words or addresses, each in full. */
const contentItemsShape = z.array(
    z.object({ name: z.string().max(FACT_NAME_MAX), kind: z.enum(["text", "address"]), value: z.string() }),
)

/**
 * The content of an ask, read back from the door's error param: every item in full (never cut to a fact's width), or nothing when the
 * param is absent or unreadable (the card then posts with its facts only).
 */
export const contentOfAsk = (candidate: unknown): ApprovalCardContent => {
    const read = contentItemsShape.safeParse(candidate)
    return read.success ? read.data : []
}

/** The longest line of the card's call (agent-sdk `approval.decision` call members). */
const CALL_LINE_MAX = 300

/**
 * The worded title of the call's tool for the card's "Thao tác" row, from its plugin's tool label (`{ vi, en }`), bounded; nothing when
 * the tool declares no label (the card then names the tool by its id).
 */
export const callLabelOf = (
    title: { readonly vi: string; readonly en: string } | null | undefined,
): { readonly label?: { readonly vi: string; readonly en: string } } =>
    title === null || title === undefined
        ? {}
        : { label: { vi: title.vi.slice(0, CALL_LINE_MAX), en: title.en.slice(0, CALL_LINE_MAX) } }

/** A text bounded to the card's longest text. */
export const cardTextOf = (text: string): string => text.trim().slice(0, CARD_TEXT_MAX)

/**
 * The preview a card carries, from a candidate `{ kind, payload }`: the kind must be one a PACKAGE registered (`kindOf` answers it; a
 * core kind never is), and the payload must pass that kind's schema (it is kept as the schema parsed it). Anything else is no preview:
 * null, and the card still posts without one.
 */
export const previewOf = (
    candidate: unknown,
    kindOf: (id: string) => AgentMessageKind | null,
): ApprovalCardPreview | null => {
    if (typeof candidate !== "object" || candidate === null) return null
    const kind: unknown = Reflect.get(candidate, "kind")
    if (typeof kind !== "string" || kind === "" || CORE_KIND_IDS.has(kind)) return null
    const registered = kindOf(kind)
    if (registered === null) return null
    const parsed = registered.payload.safeParse(Reflect.get(candidate, "payload"))
    return parsed.success ? { kind, payload: parsed.data } : null
}

/** A two-language text of a declaration (`{ vi, en }`) in the team's language, or empty when the value is none. */
export const declaredTextOf = (value: unknown, locale: "vi" | "en"): string => {
    if (typeof value === "string") return value
    if (typeof value !== "object" || value === null) return ""
    const text: unknown = Reflect.get(value, locale)
    return typeof text === "string" ? text : ""
}
