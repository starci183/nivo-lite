import {
    packageKindRefusalOf,
    type AgentMessageKind,
    type AgentMessagePreview,
    type ApprovalDecisionPayload,
} from "@nivo-lite/agent-sdk/team-chat"
import { z } from "zod"
import { messageFactGroupsOf } from "./agent-message-facts"

/** The names of the rows an approval card draws besides the engine's own facts, in the viewer's language. */
export interface ApprovalRowWords {
    /** The row of the step: its title and what it does. */
    readonly step: string
    /** The row of the account the call goes through (and, while the call has no worded label, the only row of it). */
    readonly account: string
    /** The name of the row of the operation; the same word names the technical row of the tool or effect id. */
    readonly tool: string
    /** The viewer's language: it picks the side of the call's worded label. */
    readonly locale: "vi" | "en"
    /** The technical row of the installed node id. */
    readonly node: string
}

/** One name/value row of an approval card, with a stable id. */
export interface ApprovalRow {
    /** A stable id of the row (its kind and place), safe as a list key. */
    readonly id: string
    /** The name the row is read by, in the viewer's language. */
    readonly name: string
    /** What the row holds. */
    readonly value: string
}

/** The rows of an approval card: the list a person reads, and the technical rows folded away. */
export interface ApprovalRows {
    /** The rows a person reads, in order: the step (title and what it does), the account, the engine's worded facts. */
    readonly worded: ReadonlyArray<ApprovalRow>
    /** The rows folded away: the tool id, the node id and every raw fact. */
    readonly technical: ReadonlyArray<ApprovalRow>
}

const row = (id: string, name: string, value: string | null | undefined): ReadonlyArray<ApprovalRow> =>
    value === undefined || value === null || value.trim() === "" ? [] : [{ id, name, value }]

/** The step as one line: its title, then what it does ("Refund · Refund the customer when a paid order is cancelled"). */
const stepLineOf = (step: ApprovalDecisionPayload["step"]): string =>
    step === undefined ? "" : [step.title, step.description].map((part) => part.trim()).filter((part) => part !== "").join(" · ")

/** The separator between the operation and the account in the one row they share. */
const OPERATION_SEPARATOR = " · "

/**
 * The call's worded label (the tool manifest's title in both languages, `ApprovalDecisionCall.label`), read defensively: a row is JSON
 * from the store, so a narrow parse of just `call.label` gives the row only when it is a well-formed pair, and a missing or malformed
 * label gives nothing.
 */
const callLabelSchema = z.object({ call: z.object({ label: z.object({ vi: z.string().max(300), en: z.string().max(300) }) }) })

/** The call's label in the viewer's language; an empty string when it is absent, malformed or blank. */
const callLabelOf = (payload: ApprovalDecisionPayload, locale: "vi" | "en"): string => {
    const parsed = callLabelSchema.safeParse(payload)
    return parsed.success ? parsed.data.call.label[locale].trim() : ""
}

/**
 * The rows of an approval card from its payload: the step (its title, then what it does), the operation (the call's worded label, with
 * the account after it; the account stays its own row while the call has no label), then the engine's worded facts
 * (the amounts and the call's arguments, worded by code from the real arguments); the tool id, the node id and every `technical` fact
 * go to the technical rows. An older row with no step, call or facts gives no rows.
 */
export const approvalRowsOf = (payload: ApprovalDecisionPayload, words: ApprovalRowWords): ApprovalRows => {
    const groups = messageFactGroupsOf(payload.facts ?? [])
    const label = callLabelOf(payload, words.locale)
    const account = payload.call?.account?.trim() ?? ""
    const operation = [label, account].filter((part) => part !== "").join(OPERATION_SEPARATOR)
    return {
        worded: [
            ...row("step", words.step, stepLineOf(payload.step)),
            ...(label === "" ? row("account", words.account, account) : row("operation", words.tool, operation)),
            ...groups.worded,
        ],
        technical: [
            ...row("tool", words.tool, payload.call?.tool),
            ...row("node", words.node, payload.step?.nodeId),
            ...groups.technical,
        ],
    }
}

/**
 * The view that draws a preview, with the payload as its kind parsed it. Nothing (the card is drawn without a preview) when no view
 * is registered for the kind, when the kind is a core one or declares a verdict, or when the payload fails the kind's schema.
 */
export const previewViewOf = <View extends { readonly kind: AgentMessageKind }>(
    preview: AgentMessagePreview | undefined,
    views: ReadonlyArray<View>,
): { readonly view: View; readonly payload: unknown } | null => {
    if (preview === undefined) return null
    const view = views.find((entry) => entry.kind.id === preview.kind)
    if (view === undefined || packageKindRefusalOf(view.kind) !== null) return null
    const parsed = view.kind.payload.safeParse(preview.payload)
    return parsed.success ? { view, payload: parsed.data } : null
}
