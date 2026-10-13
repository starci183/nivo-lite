const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const CODE = /^[a-z0-9_-]{1,40}$/u

/** What a member can ask to pay. */
export type RequestKind = "plan" | "renew" | "topup" | "upgrade"

/** A request to pay, already bounded; a renewal names no target (it is sent as an empty text). */
export interface PaymentOrderRequestCommand {
    readonly workspaceId: string
    readonly kind: RequestKind
    readonly target: string
}

type Parsed<T> = { readonly success: true; readonly data: T } | { readonly success: false }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null

const KINDS: ReadonlyArray<RequestKind> = ["plan", "renew", "topup", "upgrade"]

/** Bounds a request to pay before it reaches the database. */
export const paymentOrderRequestSchema = {
    safeParse: (input: unknown): Parsed<PaymentOrderRequestCommand> => {
        if (!isRecord(input)) return { success: false }
        const { workspaceId, kind, target } = input
        const found = KINDS.find((candidate) => candidate === kind)
        if (typeof workspaceId !== "string" || !UUID.test(workspaceId) || found === undefined) return { success: false }
        if (found === "renew") return { success: true, data: { workspaceId, kind: found, target: "" } }
        if (typeof target !== "string" || !CODE.test(target)) return { success: false }
        return { success: true, data: { workspaceId, kind: found, target } }
    },
}
