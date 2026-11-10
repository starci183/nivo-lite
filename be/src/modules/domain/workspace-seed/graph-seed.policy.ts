import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { Access, Purpose } from "@modules/domain/agent-connections"
import type { MANAGEMENT_CONNECTION_IDS } from "@modules/domain/channel-provisioning"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { parseJsonText } from "@modules/platform/primitives"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"

const invalid = (): never => {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const documentOf = (entry: unknown): unknown => (isRecord(entry) && "document" in entry ? entry.document : invalid())

/**
 * The graph specs of the envelope the stack seed step writes on stdin (one line of JSON, a document for each file of the folder). A
 * document that is not a graph spec, or a module with two graphs, is refused; nothing of a document is named in the refusal.
 */
export const readGraphSpecs = (text: string): ReadonlyArray<GraphSpec> => {
    const read = parseJsonText(text)
    const envelope = read.ok ? read.value : invalid()
    if (!isRecord(envelope) || !Array.isArray(envelope.documents)) return invalid()
    const specs = envelope.documents.map((entry: unknown) => {
        const parsed = graphSpecSchema.safeParse(documentOf(entry))
        return parsed.success ? parsed.data : invalid()
    })
    const keys = specs.map((spec) => spec.moduleKey)
    return new Set(keys).size === keys.length ? specs : invalid()
}

/** One connection of the management workspace a module's agent is assigned to ("Giao cho agent"). */
export interface ConnectionBinding {
    /** Which of the management connections. */
    readonly connection: keyof typeof MANAGEMENT_CONNECTION_IDS
    /** What the agent uses it for. */
    readonly purpose: Purpose
    /** What the agent may do through it. */
    readonly access: Access
}

/**
 * The connections each module's agent is assigned to in the seeded workspace, by module key: the accounting agent reads the SePay bank
 * feed, the sales agent reads the SePay account the payment QR it sends a customer is drawn from, the chatbot answers on the Zalo OA and on Telegram. A connection the workspace does not hold is skipped by the seed.
 */
export const CONNECTION_BINDINGS: Readonly<Record<string, ReadonlyArray<ConnectionBinding>>> = {
    accounting: [{ connection: "sepay", purpose: "bank_feed", access: "auto" }],
    sales: [{ connection: "sepay", purpose: "data_source", access: "read" }],
    chatbot: [
        { connection: "zaloOa", purpose: "inbound_chat", access: "auto" },
        { connection: "telegram", purpose: "inbound_chat", access: "auto" },
    ],
}
