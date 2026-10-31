import { parseJsonText } from "@modules/platform/primitives"
import type { InternalProposal } from "./agent-turns.contracts"
import { ACTIONS_MAX, REPLY_MAX, TASKS_MAX, internalProposalSchema } from "./internal-contract.schema"

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The JSON object in a model answer: the whole text, a fenced block, or the outermost braces; null when there is none. */
const objectIn = (raw: string): Readonly<Record<string, unknown>> | null => {
    const unfenced = raw.replace(/^```(?:json)?\s*/iu, "")
    const body = (unfenced.endsWith("```") ? unfenced.slice(0, -3) : unfenced).trim()
    const whole = parseJsonText(body)
    if (whole.ok && isObject(whole.value)) return whole.value
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    const inner = parseJsonText(body.slice(start, end + 1))
    return inner.ok && isObject(inner.value) ? inner.value : null
}

/** A list cut to its bound before validation, so an over-long list loses its tail and is not refused. */
const cut = (value: unknown, max: number): unknown => (Array.isArray(value) ? value.slice(0, max) : value)

/** A text that is no proposal is just something to say: no task and no action. */
const plain = (reply: string): InternalProposal => ({
    reply: reply.trim().slice(0, REPLY_MAX),
    tasks: [],
    actions: [],
    needsHuman: false,
    reason: "",
})

/**
 * Reads what a tag or background turn answered. Text that is no JSON object, or an object that fails the schema, is a plain reply with no
 * tasks and no actions; a list over its bound loses its tail; an action with no subject stays a request with no subject.
 */
export const readInternalProposal = (text: string): InternalProposal => {
    const object = objectIn(text)
    if (object === null) return plain(text)
    const parsed = internalProposalSchema.safeParse({
        ...object,
        tasks: cut(object.tasks, TASKS_MAX),
        actions: cut(object.actions, ACTIONS_MAX),
    })
    if (!parsed.success) return plain(typeof object.reply === "string" ? object.reply : text)
    const { data } = parsed
    return {
        reply: data.reply.trim(),
        needsHuman: data.needsHuman,
        reason: data.reason,
        tasks: data.tasks.map((task) => ({
            op: task.op,
            key: task.key,
            ...(task.title === undefined ? {} : { title: task.title }),
            ...(task.nextActionAt === undefined ? {} : { nextActionAt: new Date(task.nextActionAt) }),
        })),
        actions: data.actions.map((action) => ({
            action: action.action,
            ...(action.subject === undefined ? {} : { subject: action.subject }),
            leadId: action.leadId ?? null,
            fields: action.fields,
            summary: action.summary,
        })),
    }
}
