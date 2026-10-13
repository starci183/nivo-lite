import type { WorkEdits } from "@/lib/flow-types"

type Parse<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const isId = (value: unknown): value is string => typeof value === "string" && value.length >= 1 && value.length <= 64

const recordOf = (input: unknown): Readonly<Record<string, unknown>> | null =>
    typeof input === "object" && input !== null ? Object.fromEntries(Object.entries(input)) : null

const decisionOf = (value: unknown): "approved" | "rejected" | null =>
    value === "approved" || value === "rejected" ? value : null

/** Bounds one id (a work item, an order or a draft). */
export const salesIdSchema = {
    safeParse: (input: unknown): Parse<string> => (isId(input) ? { success: true, data: input } : { success: false }),
}

/** What deciding a work item or a legacy draft takes. */
export interface DecisionInput {
    readonly id: string
    readonly decision: "approved" | "rejected"
    readonly edits: WorkEdits | undefined
    readonly editedDraft: string | undefined
}

const editsOf = (value: unknown): WorkEdits | undefined => {
    const fields = recordOf(value)
    if (fields === null) return undefined
    const draft = typeof fields.draft === "string" ? { draft: fields.draft.slice(0, 4000) } : {}
    const amount =
        typeof fields.amount_vnd === "number" || fields.amount_vnd === null ? { amount_vnd: fields.amount_vnd } : {}
    const named = recordOf(fields.fields)
    const values =
        named === null
            ? {}
            : {
                  fields: Object.fromEntries(
                      Object.entries(named).flatMap(([name, entry]): Array<[string, string | number | null]> =>
                          typeof entry === "string" || typeof entry === "number" || entry === null
                              ? [[name.slice(0, 64), typeof entry === "string" ? entry.slice(0, 500) : entry]]
                              : [],
                      ),
                  ),
              }
    return { ...draft, ...amount, ...values }
}

/** Bounds the id, the decision and the edits a person typed. */
export const decisionSchema = {
    safeParse: (input: unknown): Parse<DecisionInput> => {
        const fields = recordOf(input)
        const decision = decisionOf(fields?.decision)
        if (fields === null || !isId(fields.id) || decision === null) return { success: false }
        const editedDraft = typeof fields.editedDraft === "string" ? fields.editedDraft.slice(0, 4000) : undefined
        return { success: true, data: { id: fields.id, decision, edits: editsOf(fields.edits), editedDraft } }
    },
}

/** What marking an order shipped takes. */
export interface ShipInput {
    readonly orderId: string
    readonly carrier: string
    readonly trackingCode: string
}

/** Bounds the order, the carrier and the tracking code. */
export const shipSchema = {
    safeParse: (input: unknown): Parse<ShipInput> => {
        const fields = recordOf(input)
        const carrier = fields?.carrier
        const trackingCode = fields?.trackingCode
        if (fields === null || !isId(fields.orderId) || typeof carrier !== "string" || typeof trackingCode !== "string")
            return { success: false }
        return {
            success: true,
            data: { orderId: fields.orderId, carrier: carrier.slice(0, 80), trackingCode: trackingCode.slice(0, 80) },
        }
    },
}

/** What retrying or stopping a failed step takes. */
interface FailedStepInput {
    readonly id: string
    readonly action: "retry" | "stop"
}

/** Bounds the failed work item and what to do with it. */
export const failedStepSchema = {
    safeParse: (input: unknown): Parse<FailedStepInput> => {
        const fields = recordOf(input)
        if (fields === null || !isId(fields.id)) return { success: false }
        if (fields.action !== "retry" && fields.action !== "stop") return { success: false }
        return { success: true, data: { id: fields.id, action: fields.action } }
    },
}
