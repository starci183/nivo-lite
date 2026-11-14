import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { CORE, WS, drain, itemsOf, processOf, refOf, rowsOf, startThread, stopsOf, threadDbOf, type ThreadDb } from "./thread-world"
import { DESK_LEDGER } from "@tests/fixtures/builders/thread-desk-plugin.builder"

// The world's desk installed beside the core: an agent step that acts itself, on the template road (`thread-desk-plugin.builder.ts`).
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const desk: typeof import("@tests/fixtures/builders/thread-desk-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/thread-desk-plugin.builder",
    )
    return { installed: parts.installationWith([desk.DESK_PLUGIN], "world-desk") }
})

// The second dev walk, defect 7: the ledger step (`accounting.post-payment`) REQUIRES `nivo.tool.ledger.entry.append`. Its call asked the
// owner; the owner approved; the ENGINE ran exactly that call, once, and handed the step its answer with the words "do not call it
// again". The step's agent then offered its output and was refused `REQUIRED_CALL_MISSING` (the required tool had not been called BY
// THE AGENT in that run), three turns over, and ended confused: a step that did not recognise its own approved result. The call the
// engine ran for the step now counts as done by the step (`alreadyDone`), so the step ends on the answer, on its next turn.

/** The model purpose of the ledger step (the SDK's agent loop: `<node id>:agent`). */
const LEDGER = DESK_LEDGER

const STEP = "ledger"

/** One step that writes a settled payment into the ledger, with its tool granted. */
const ledgerFlow: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [TOOL.ledgerEntryAppend], effects: [] },
    nodes: [
        {
            key: STEP,
            kind: "output",
            step: "wdesk.ledger",
            // The step's ONE mode, set by the workflow on its step (nivo-frame `rights`): `ask`, so the append waits for the owner.
            mode: "ask",
            params: {},
            input: { transactionId: { $ref: "trigger.transactionId" }, orderId: { $ref: "trigger.orderId" } },
        },
    ],
}

const APPEND = { call: { tool: TOOL.ledgerEntryAppend, args: { transactionId: "tx-1" } } }

/** One answer the world's model is scripted to give. */
type ScriptedAnswer = Parameters<ThreadDb["model"]["script"]>[1]

/** The ledger appends the door let through, with who approved each. */
const appendsOf = (db: ThreadDb) => (db.rights.toolCalls ?? []).filter((one) => one.tool === TOOL.ledgerEntryAppend)

/** The step asks for the append; one item, one approval stop; the owner approves it. */
const askedThenApproved = async (db: ThreadDb, after: ReadonlyArray<ScriptedAnswer>) => {
    db.rights.asks?.add(TOOL.ledgerEntryAppend)
    db.model.script(LEDGER, APPEND)
    const process = await processOf(db)
    const started = await startThread(process, {
        flow: ledgerFlow,
        versionId: "accounting-agent:ledger@1", workflowId: "wf:ledger",
        trigger: { transactionId: "tx-1", orderId: "order-1", locale: "vi" },
    })
    const runId = started.runId ?? ""
    expect(started.error).toBeNull()
    expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([[STEP, "approval", "open"]])
    expect(appendsOf(db)).toEqual([])
    const asked = db.model.askedOf(LEDGER).length
    db.model.script(LEDGER, ...after)
    const from = db.wakes.length
    await process.approvals?.decided(
        { workspaceId: WS, runId, stepKey: STEP, workItemId: itemsOf(db)[0]?.item.id ?? "", verdict: "approved", by: "owner-1", text: "" },
        process.requests,
    )
    const ran = await drain(process, from)
    return { process, runId, ran, turnsAfter: db.model.askedOf(LEDGER).length - asked }
}

describe("an approved call of a tool the step REQUIRES", () => {
    it("the step completes on its next turn with the call's answer: zero extra turns, no worded answer, the call made once", async () => {
        const db = threadDbOf()

        const { process, runId, ran, turnsAfter } = await askedThenApproved(db, [{ done: { ref: "Ledger!A18:H18" } }])

        expect(ran.map((one) => one.error)).toEqual([null])
        // ONE model turn after the approval: the agent reads the engine's answer and ends; it is not refused for a missing call.
        expect(turnsAfter).toBe(1)
        expect(appendsOf(db)).toEqual([expect.objectContaining({ tool: TOOL.ledgerEntryAppend, args: { transactionId: "tx-1" }, approvedBy: "owner-1" })])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
        expect((await stopsOf(process, runId)).map((stop) => stop.state)).toEqual(["resolved"])
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        expect(JSON.stringify(rowsOf(db, runId).steps.at(-1))).toContain("Ledger!A18:H18")
        // The engine's answer of the approved call is what the agent was handed on that turn.
        expect(JSON.stringify(db.model.askedOf(LEDGER).at(-1)?.request)).toContain(`NIVO already ran exactly that call`)
    })

    it("an agent that calls the tool again anyway is answered from the same call (once per key): still one append", async () => {
        const db = threadDbOf()

        const { process, runId } = await askedThenApproved(db, [APPEND, { done: { ref: "Ledger!A18:H18" } }])

        expect(appendsOf(db)).toHaveLength(1)
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })
})
