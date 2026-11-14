import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    ANSWER,
    CONTACT,
    CONV,
    ZALO,
    WS,
    customersSay,
    drain,
    founderDecides,
    button,
    itemsOf,
    processOf,
    refOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"
import { chatServicesOf } from "./thread-world-intake"

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

// R23 (coordinator, 2026-11-14): ONE approval mechanism. A customer send that needs a person's yes is the generic approval at the tool
// call: the step is `ask`, the engine raises the approval stop (an owner's item and the /chat card, the message not yet sent), the owner
// approves through the approvals door, the send runs ONCE with the approver, and a refusal is data the step reads. The chatbot's own draft
// road (a `proposed` line, approve-and-send) is not what this proves: it no longer exists in the engine. The real tool door judges the
// step's mode, the real executor sends through the real ledger; only the provider's push is a double.

const STEP = "answer"
const TEXT = "Shop mo cua tu 8h den 21h a."

/** A one-step flow whose agent sends a line to the customer of the route, the step declared `ask`. */
const askingFlow: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [TOOL.brainSearch], effects: [TOOL.customerMessageSend] },
    nodes: [
        {
            key: STEP,
            kind: "output",
            step: "wdesk.answer",
            mode: "ask",
            params: { conversationId: { $ref: "trigger.routeId" }, text: { $ref: "trigger.data.text" } },
        },
    ],
}

// The generic trigger scope of a customer line (the engine's own members: route, contact, account, event, data).
const TRIGGER = {
    eventId: "zalo:m-ask-1",
    routeId: CONV,
    contactId: CONTACT,
    accountId: ZALO,
    subject: { channel: "zalo", id: "zalo-user-1" },
    data: { text: "Shop mo cua may gio?", messageKey: "zalo:m-ask-1" },
    locale: "vi",
}

const sends = { call: { tool: TOOL.customerMessageSend, args: { text: TEXT } } }
const DONE = { done: { reply: TEXT } }

/** The send raises the approval: one owner's item, one approval stop, nothing said to the customer yet. */
const asked = async (db: ThreadDb) => {
    db.model.script(ANSWER, sends, DONE)
    const process = await processOf(db)
    const started = await startThread(process, { flow: askingFlow, versionId: "chatbot-agent:ask-send@1", workflowId: "wf:ask-send", trigger: TRIGGER })
    expect(started.error).toBeNull()
    const runId = started.runId ?? ""
    expect(itemsOf(db)).toHaveLength(1)
    expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([[STEP, "approval", "open"]])
    expect(db.lines).toEqual([])
    expect(db.chat.ledger.rows).toEqual([])
    return { process, runId }
}

describe("a customer send on an `ask` step: the generic approval", () => {
    it("raises the approval stop with the whole message on its card; nothing is sent before the owner's yes", async () => {
        const db = threadDbOf()
        const { process, runId } = await asked(db)
        const [stop] = await stopsOf(process, runId)
        expect(stop?.detail.approvalCard).toMatchObject({ step: { nodeId: "wdesk.answer" }, call: { tool: TOOL.customerMessageSend } })
        expect(JSON.stringify(stop?.detail.approvalCard)).toContain(TEXT)
    })

    it("approved through the owner door: the send runs exactly once, as the step's agent, and the run ends", async () => {
        const db = threadDbOf()
        const { process, runId } = await asked(db)
        const from = db.wakes.length
        const workItemId = itemsOf(db)[0]?.item.id ?? ""

        const decided = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: STEP, workItemId, verdict: "approved", by: "owner-1", text: "" },
            process.requests,
        )
        expect(decided).toMatchObject({ kind: "admitted" })
        // A send is an effect: the engine does not run it for the model (`ApprovedRun.answer` is null for an effect's right); the step runs again
        // and the SAME call the model makes now runs as approved, once (thread-approvals.service.ts `ApprovedRun`).
        db.model.script(ANSWER, sends, DONE)
        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(db.lines.map((line) => line.text)).toEqual([TEXT])
        expect(db.chat.ledger.rows.map((row) => [row.state, row.text])).toEqual([["delivered", TEXT]])
        expect((await stopsOf(process, runId)).map((stop) => [stop.kind, stop.state])).toEqual([["approval", "resolved"]])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })

    it("refused by the owner: nothing is sent, the refusal is data the step reads (it is not run again as if approved)", async () => {
        const db = threadDbOf()
        const { process, runId } = await asked(db)
        const from = db.wakes.length
        const workItemId = itemsOf(db)[0]?.item.id ?? ""

        const decided = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: STEP, workItemId, verdict: "refused", by: "owner-1", text: "" },
            process.requests,
        )
        expect(decided).toMatchObject({ kind: "admitted" })
        await drain(process, from)

        expect(db.lines).toEqual([])
        expect(db.chat.ledger.rows.filter((row) => row.state === "delivered")).toEqual([])
    })

    it("skipped by the founder: the run ends, the owner's item is withdrawn, nothing is sent", async () => {
        const db = threadDbOf()
        const { process, runId } = await asked(db)

        await founderDecides(process, runId, button(db, "skip"))

        expect(db.lines).toEqual([])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })
})

// REFUSE BEFORE ASK (rights rule 11): the tool door asks the executor what it would answer (`refusalFor`) BEFORE it raises a person's
// approval, so nobody approves a message that cannot go. Two refusals of the REAL send executor over the world's stores: the Zalo reply window
// (the person's last line is older than ZALO_FREE_WINDOW_MS, read from the engine's own store of the conversation) and the staff hold (R43:
// a member took the route over; AI sends are refused `route_held` until it is handed back). In both: no owner's item, no stop, nothing sent.
describe("a customer send the door would refuse is refused before any approval is asked", () => {
    const refusedBeforeAsk = async (db: ThreadDb, process: Awaited<ReturnType<typeof processOf>>) => {
        db.model.script(ANSWER, sends, DONE)
        const started = await startThread(process, { flow: askingFlow, versionId: "chatbot-agent:ask-send@1", workflowId: "wf:ask-send", trigger: TRIGGER })
        expect(started.error).toBeNull()
        const runId = started.runId ?? ""
        expect(itemsOf(db)).toEqual([])
        // The refusal is the step's own trouble (the AI core reads it: the script has no answer for it, so a trouble stop opens), never an APPROVAL.
        expect((await stopsOf(process, runId)).map((stop) => stop.kind)).not.toContain("approval")
        expect(db.lines).toEqual([])
        expect(db.chat.ledger.rows.filter((row) => row.state === "delivered")).toEqual([])
        return { process, runId }
    }

    it("the Zalo reply window is closed (the person wrote more than 48 h ago): refused, no card", async () => {
        const db = threadDbOf()
        const process = await processOf(db)
        await customersSay(process, [{ text: "Shop oi", key: "m-window-1" }])
        db.clock.advance(49 * 3_600_000)

        await refusedBeforeAsk(db, process)
    })

    it("a member holds the route: refused, no card; handed back, the same send raises the approval", async () => {
        const db = threadDbOf()
        const process = await processOf(db)
        await customersSay(process, [{ text: "Shop oi", key: "m-hold-1" }])
        await chatServicesOf(db).routes.hold(WS, CONV, "member-1")

        await refusedBeforeAsk(db, process)

        await chatServicesOf(db).routes.release(WS, CONV)
        await asked(db)
    })
})
