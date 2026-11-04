import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { LedgerStatusResult } from "../../vocabulary"
import type { NodeSchema } from "../node-schema.types"
import { bilingualOf } from "../../messages/catalog"
import { isRecordable } from "./ledger.policy"
import type { LedgerResult } from "./ledger.policy"

/** How the settlement came out. */
interface LedgerReadyInput {
    readonly result: LedgerResult
}

/** The way the graph goes on: `record` when there is something to write and somewhere to write it, `skip` otherwise. */
interface LedgerReadyOutput {
    readonly branch: "record" | "skip"
}

const STATUS_TOOL = "ledger.status" as const

const params: z.ZodObject<Record<string, never>> = z.object({})
const input: NodeSchema<LedgerReadyInput> = z.object({ result: z.enum(["paid", "already-paid", "raised", "voided"]) })
const output: NodeSchema<LedgerReadyOutput> = z.object({ branch: z.enum(["record", "skip"]) })

/** What the provider said about the ledger: connected or not, and the failure when it could not answer. */
interface LedgerProbe {
    readonly connected: boolean
    readonly cause?: unknown
}

/** Whether the workspace has a ledger; a provider that cannot answer is no ledger, because this step must never fail a run. */
const connected = async (ask: () => Promise<LedgerStatusResult>): Promise<boolean> => {
    const probe = await ask().then(
        (status): LedgerProbe => ({ connected: status.connected }),
        (cause: unknown): LedgerProbe => ({ connected: false, cause }),
    )
    return probe.connected
}

/**
 * `accounting.ledger-ready`: a condition that goes `record` when the settlement put money against an order (or took an entry back) and the
 * workspace has a ledger connected and told where to write; otherwise `skip`. It only reads, so a workspace without a ledger skips the step
 * and the run goes on.
 */
export const accountingLedgerReadyNode: NodeDefinition<
    NodeSchema<LedgerReadyInput>,
    NodeSchema<LedgerReadyOutput>,
    z.ZodObject<Record<string, never>>
> = defineNode({
    id: "accounting.ledger-ready",
    role: "condition",
    title: bilingualOf("nodeAccountingLedgerReadyTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [],
    tools: [STATUS_TOOL],
    run: async (given, context) => {
        const writable = isRecordable(given.result) || given.result === "voided"
        const ready = writable && (await connected(() => context.tools.call<LedgerStatusResult>(STATUS_TOOL, {})))
        return { branch: ready ? "record" : "skip" }
    },
    examples: [
        {
            name: "records when money was put against an order and a ledger is connected",
            params: {},
            input: { result: "paid" },
            output: { branch: "record" },
            effects: [],
            tools: [{ connected: true }],
        },
        {
            name: "skips when no ledger is connected",
            params: {},
            input: { result: "paid" },
            output: { branch: "skip" },
            effects: [],
            tools: [{ connected: false }],
        },
        {
            name: "skips when the provider answers something unreadable, because this step never fails a run",
            params: {},
            input: { result: "voided" },
            output: { branch: "skip" },
            effects: [],
            tools: [{ unexpected: true }],
        },
        {
            name: "skips a settlement that was only raised to the owner, without asking the provider",
            params: {},
            input: { result: "raised" },
            output: { branch: "skip" },
            effects: [],
        },
    ],
})
