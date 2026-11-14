import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { JsonObject } from "@nivo-lite/agent-sdk/schema"
import type { NodeContext } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_BODY, MAX_LINE } from "../../../shared/bounds"
import { sayToCustomer } from "../../../shared/customer-chat/say-to-customer"
import { valueOrCannot } from "../../../shared/nodes/tool-answers"
import type { CareKind } from "./care.policy"

/**
 * How a care node talks: the agent WRITES (one `ctx.agent.run` with an empty tool subset, `tools: []`; a node whose one message is
 * customer-facing keeps a second turn, `maxTurns: 2`, only for an answer the agent loop refused), the node SENDS
 * (`ctx.tools.call`), so the send, its args and its refusal are the node's and an example scripts them exactly.
 */

/**
 * How every care agent writes to a customer, appended to its goal. Guidance, not code: what to say is the agent's call from the facts
 * it is given. No tool shape, no channel, no holding line: the node sends, the engine reports what it cannot.
 */
export const CARE_VOICE: string =
    "Write as the shop, warm and short, in the customer's language (`locale`: vi = Vietnamese, en = English). Write ONE message with at " +
    "most one question. Use only the facts you are given: never promise a refund, a discount, a delivery day or anything the facts do " +
    "not hold, and never type an amount that is not in the facts."

/** The message a care agent writes for the customer. */
export interface CareMessage {
    /** The text, as the customer reads it. */
    readonly text: string
}

/** The answer a care agent gives: the one message. */
export const careMessageSchema: z.ZodType<CareMessage> = z.object({
    text: z.string().min(1).max(MAX_BODY).describe("The one message to the customer, in their language."),
})

/** The note a care agent writes for the team chat. */
export interface TeamNote {
    /** A short title the team reads first. */
    readonly title: string
    /** The note, in the team's language. */
    readonly text: string
}

/** The answer an agent gives that writes to the team: a title and a text. */
export const teamNoteSchema: z.ZodType<TeamNote> = z.object({
    title: z.string().min(1).max(MAX_LINE).describe("A short title, in the team's language."),
    text: z.string().min(1).max(MAX_BODY).describe("The note, in the team's language."),
})

/** What a send came to: it reached the customer, or the refusal the tool answered. */
export interface SendResult {
    /** True when the message reached the customer. */
    readonly sent: boolean
    /** The tool's refusal code when it did not, else null. */
    readonly refusal: string | null
}

/**
 * Says the words to the person (`nivo.tool.customer.message.send` by `contactId`: the conversation picks the channel); a refusal is
 * answered as a fact, never tried another way.
 */
export const sendToContact = async (
    context: Pick<NodeContext, "tools" | "fail" | "run" | "workspace">,
    contactId: string,
    text: string,
): Promise<SendResult> => {
    const said = await sayToCustomer(context, { contactId, text })
    return said.ok ? { sent: true, refusal: null } : { sent: false, refusal: said.refusal }
}

/** One care timer as a care step means it: the step, the record it is about, the item within it, when, and the small data it carries. */
export interface CareTimer {
    /** The care step: what the due timer wakes (`data.kind`, the field every timer graph of the agent keys on). */
    readonly kind: CareKind
    /** The record it is about (an order, a customer). */
    readonly ref: string
    /** The item within the record (an occasion), when there is one. */
    readonly item?: string
    /** The instant it is due, ISO 8601; or `afterHours` from now. */
    readonly dueAt?: string
    /** Hours from now until it is due. */
    readonly afterHours?: number
    /** Small flat data it hands back when due (the shipment looks). */
    readonly data?: Readonly<Record<string, number>>
}

/** The key of a care timer (`nivo.tool.timer.arm` `ref`): the step, then the item, else the record: arming it again moves the same timer. */
export const careTimerRefOf = (kind: CareKind, record: string, item?: string): string => `${kind}:${item ?? record}`

/**
 * The arguments of `nivo.tool.timer.arm` for a care timer: its key, its moment and its data, with `kind` (the field every timer graph of
 * the agent keys on), the `record` and the `item` in the data, so the woken graph reads them back from `trigger.data`.
 */
export const careTimerArgsOf = (timer: CareTimer): JsonObject => ({
    ref: careTimerRefOf(timer.kind, timer.ref, timer.item),
    ...(timer.dueAt === undefined ? { afterMinutes: (timer.afterHours ?? 0) * 60 } : { dueAt: timer.dueAt }),
    data: {
        kind: timer.kind,
        record: timer.ref,
        ...(timer.item === undefined ? {} : { item: timer.item }),
        ...timer.data,
    },
})

/** What arming a care timer came to: a person declined it on its card (the timer is not armed), or it is armed. */
export interface ArmResult {
    /** True when a person declined arming the timer on its card: nothing was armed. */
    readonly declined: boolean
}

/**
 * Arms (or moves) one care timer (`nivo.tool.timer.arm`, the engine's generic timer: it wakes this agent's graph whose trigger keys on
 * `data.kind`). A person declining the arm is a business outcome: the result says `declined: true` and the calling node returns its
 * declined form. Any other refusal is never reported as armed: it ends the node `cannot` with the refusal and its facts, for the engine's report.
 */
export const armCare = async (context: Pick<NodeContext, "tools" | "fail">, timer: CareTimer): Promise<ArmResult> => {
    const armed = await context.tools.call(TOOL.timerArm, careTimerArgsOf(timer))
    if (!armed.ok && armed.declined === true) return { declined: true }
    valueOrCannot(context, TOOL.timerArm, armed)
    return { declined: false }
}

/** What cancelling a care timer came to: declined by a person, or whether one was waiting. */
export interface CancelResult {
    /** True when a person declined the cancel on its card: nothing was cancelled. */
    readonly declined: boolean
    /** True when a timer was waiting and is now cancelled; false when none was or the cancel was declined. */
    readonly cancelled: boolean
}

/**
 * Cancels one care timer by its key (`nivo.tool.timer.cancel`); answers whether one was waiting, or that a person declined. Any other
 * refusal ends the node `cannot`.
 */
export const cancelCare = async (
    context: Pick<NodeContext, "tools" | "fail">,
    kind: CareKind,
    record: string,
): Promise<CancelResult> => {
    const called = await context.tools.call(TOOL.timerCancel, { ref: careTimerRefOf(kind, record) })
    if (!called.ok && called.declined === true) return { declined: true, cancelled: false }
    const answer = valueOrCannot(context, TOOL.timerCancel, called)
    return { declined: false, cancelled: answer["cancelled"] === true }
}

/** Posts one note to the team chat as a question for the team to decide (`intent: ask`); a refusal is answered as a fact. */
export const askTeam = async (context: Pick<NodeContext, "tools">, note: TeamNote): Promise<SendResult> => {
    const answered = await context.tools.call(TOOL.teamMessagePost, { kind: "message.text", intent: "ask", ...note })
    return answered.ok
        ? { sent: true, refusal: null }
        : { sent: false, refusal: answered.declined === true ? "declined" : answered.refusal }
}

/** The output member a send node reports its refusal in. */
export const refusalSchema: z.ZodNullable<z.ZodString> = z
    .string()
    .max(MAX_LINE)
    .nullable()
    .describe("The refusal code the tool answered when the message did not go out, else null.")
