import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    CORE,
    WS,
    button,
    drain,
    founderDecides,
    itemsOf,
    processOf,
    refOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"
import { DESK_CHAT } from "@tests/fixtures/builders/thread-desk-plugin.builder"

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

// FX4 (D-P11-5, restart FIFTEEN re-test): in a private room the owner told Sales a new delivery fee; the team-chat turn called a tool
// under `ask`, the owner approved it, the step ran again, the MODEL REWROTE the call's arguments (same intent, other words), the approval
// (bound to the exact arguments) did not match, and it asked again: an endless loop, no answer. Now the ENGINE runs the approved call
// itself, once, through the same door under the same key, and hands the model its answer: the model is never asked to issue it again.
// A different call of the same tool in the same step after the approval is another call: it asks on a NEW approval card and never
// runs unapproved (nivo-frame rights 11d); the approved one ran once.

/** The model purpose of the team-chat turn (a template node's agent: `<node id>:agent`), the world desk's chat turn whose agent files. */
const CHAT = DESK_CHAT

/** The step of the team-chat workflow. */
const STEP = "answer"

const ROOM = "6f1c2a10-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const ASKED = "0b8e7f2a-1c3d-4e5f-9a8b-7c6d5e4f3a2b"
const RULE = "Tu mai phi ship noi thanh tang len 35k em nhe"

/** A team-chat workflow of one step whose agent files the proposal itself (the world desk's `wdesk.chat`), with the truth-graph tools and the team post. */
const chatFlow: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: [] },
    grant: {
        tools: [TOOL.brainSearch, TOOL.brainFactGet, TOOL.brainFactRelated, TOOL.brainChangePropose],
        effects: [TOOL.teamMessagePost],
    },
    nodes: [
        {
            key: STEP,
            kind: "output",
            step: "wdesk.chat",
            // The mode its template node declares, as the template adapter writes it on every node step (nivo-frame `rights`).
            mode: "auto",
            params: Object.fromEntries(
                ["roomId", "messageId", "text", "room", "intent", "asker", "lines", "locale"].map((name) => [
                    name,
                    { $ref: `trigger.${name}` },
                ]),
            ),
        },
    ],
}

const TRIGGER = {
    roomId: ROOM,
    messageId: ASKED,
    text: RULE,
    room: "direct",
    intent: "answer",
    asker: { name: "Anh", standing: "owner" },
    lines: [],
    locale: "vi",
}

/** The proposal as the model first wrote it, and as it rewrote it on the run after the approval (same intent, other words). */
const FIRST = {
    subject: "Giao hang",
    attribute: "Phi ship noi thanh",
    value: "35.000 d",
    room: "direct",
    messageId: ASKED,
    quote: RULE,
    reason: "Anh vua nhan tu mai phi ship noi thanh la 35k, thay cho 30.000 d dang dung.",
}
const REWRITTEN = { ...FIRST, reason: "Chu shop bao phi ship noi thanh tu mai la 35.000 d (dang dung 30.000 d)." }

const SEARCH = { call: { tool: TOOL.brainSearch, args: { query: "phi ship noi thanh" } } }
const proposes = (args: typeof FIRST) => ({ call: { tool: TOOL.brainChangePropose, args } })
const ANSWERED = "Em da gui de nghi doi phi ship noi thanh sang 35.000 d, cho anh bam Dong y tren the."
const DONE = { done: { answer: ANSWERED } }

/** The proposals the door let through, with who approved each. */
const proposalsOf = (db: ThreadDb) => (db.rights.toolCalls ?? []).filter((one) => one.tool === TOOL.brainChangePropose)

/** The answers the team-chat step posted in the room (not the stop's cards). */
const answersOf = (db: ThreadDb) =>
    db.team.flatMap((message) => message.versions).filter((payload) => payload.kind === "chat.answer")

/** The turn asks: the proposal waits for the owner (one item, one approval stop); then the owner approves it. */
const askedThenApproved = async (db: ThreadDb) => {
    db.rights.asks?.add(TOOL.brainChangePropose)
    db.model.script(CHAT, SEARCH, proposes(FIRST), DONE)
    const process = await processOf(db)
    const started = await startThread(process, { flow: chatFlow, versionId: "chatbot-agent:team-chat@1", workflowId: "wf:team-chat", trigger: TRIGGER })
    const runId = started.runId ?? ""
    expect(started.error).toBeNull()
    expect(itemsOf(db)).toHaveLength(1)
    expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([[STEP, "approval", "open"]])
    expect(proposalsOf(db)).toEqual([])
    // The engine built the approval card BEFORE the write: the step, the call, the facts from the real arguments, a brief.
    const [asking] = await stopsOf(process, runId)
    expect(asking?.detail.approvalCard).toMatchObject({
        step: { nodeId: "wdesk.chat" },
        call: { tool: TOOL.brainChangePropose },
    })
    expect(asking?.detail.approvalCard?.facts).toContainEqual({ name: "value", value: "35.000 d" })
    expect(asking?.detail.approvalCard?.text).not.toBe("")
    const workItemId = itemsOf(db)[0]?.item.id ?? ""
    const from = db.wakes.length
    const asked = db.model.askedOf(CHAT).length
    const decided = await process.approvals?.decided(
        { workspaceId: WS, runId, stepKey: STEP, workItemId, verdict: "approved", by: "owner-1", text: "" },
        process.requests,
    )
    expect(decided).toMatchObject({ kind: "admitted" })
    return { process, runId, from, asked }
}

describe("an approved call runs once, by the engine, whatever the model would write next", () => {
    it("approve -> the approved call has already run once with the APPROVED arguments; the model reads its answer and finishes; no second ask", async () => {
        const db = threadDbOf()
        const { process, runId, from, asked } = await askedThenApproved(db)
        // Asked to call again, this model would rewrite its words: it is not asked to, it reads the answer and finishes.
        db.model.script(CHAT, DONE)

        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(proposalsOf(db)).toEqual([
            expect.objectContaining({ args: FIRST, approvedBy: "owner-1", key: expect.stringContaining(`:${STEP}:`) }),
        ])
        const rerun = JSON.stringify(db.model.askedOf(CHAT).at(asked)?.request)
        expect(rerun).toContain("NIVO already ran exactly that call")
        expect(rerun).toContain("change-1")
        expect(itemsOf(db)).toHaveLength(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        expect(answersOf(db)).toEqual([{ kind: "chat.answer", messageId: ASKED, text: ANSWERED }])
        expect((await stopsOf(process, runId)).map((stop) => [stop.kind, stop.state])).toEqual([["approval", "resolved"]])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })

    it("the model repeats the exact approved call anyway: it answers from the same key, still one proposal", async () => {
        const db = threadDbOf()
        const { process, from } = await askedThenApproved(db)
        db.model.script(CHAT, proposes(FIRST), DONE)

        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        expect(proposalsOf(db)).toHaveLength(1)
        expect(itemsOf(db)).toHaveLength(1)
    })

    it("the model rewrites the call anyway: a NEW approval card for the rewritten arguments, never run; the approved call ran once", async () => {
        const db = threadDbOf()
        const { process, runId, from } = await askedThenApproved(db)
        db.model.script(CHAT, proposes(REWRITTEN), DONE)

        await drain(process, from)

        expect(proposalsOf(db)).toEqual([expect.objectContaining({ args: FIRST, approvedBy: "owner-1" })])
        expect(itemsOf(db)).toHaveLength(2)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        const stops = await stopsOf(process, runId)
        expect(stops.map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([[STEP, "approval", "open"]])
        expect(JSON.stringify(stops[0]?.detail.approvalCard?.facts)).toContain("Chu shop bao")
        expect(answersOf(db)).toEqual([])
    })
})

// FX4 (D-P11-6): the restart owner skipped the approval stop; its `approve_tool_call` item stayed open in the owner's inbox and the run
// page answered `decision_not_found` for it. A stop closed by any other decision withdraws its item: the stop keeps `withdrawn` first.
describe("an approval stop skipped by the founder", () => {
    it("ends the run and withdraws the owner's item it raised: nothing runs, nothing waits", async () => {
        const db = threadDbOf()
        db.rights.asks?.add(TOOL.brainChangePropose)
        db.model.script(CHAT, SEARCH, proposes(FIRST), DONE)
        const process = await processOf(db)
        const runId = (await startThread(process, { flow: chatFlow, versionId: "chatbot-agent:team-chat@1", workflowId: "wf:team-chat", trigger: TRIGGER })).runId ?? ""

        await founderDecides(process, runId, button(db, "skip"))

        const [stop] = await stopsOf(process, runId)
        expect(stop).toMatchObject({ kind: "approval", state: "resolved" })
        expect(stop?.detail.facts).toContainEqual({ name: "verdict", value: "withdrawn" })
        expect(proposalsOf(db)).toEqual([])
        expect((await process.threads.stateOf(refOf(runId)))?.status).toBe("ended")
    })
})
