import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    GraphNodesError,
    GraphNodesErrorCode,
    toolFingerprintOf,
    type NodeToolCall,
    type NodeToolDoor,
} from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { ToolCallResult } from "@modules/domain/tools"
import { templateValueOf } from "@modules/domain/tools/node-tool-answer.policy"
import { readDocument, toolOutcomeOf } from "@modules/domain/openapi-tools"
import openApiFixture from "@modules/domain/openapi-tools/openapi-document.policy.fixtures.json"
import {
    TREF_ASKED,
    TREF_CONFIRM,
    TREF_CRM,
    TREF_CRM_WRITE,
    TREF_LOOKUP,
    TREF_PROPOSAL,
    TREF_READ,
} from "@tests/fixtures/builders/template-refusal-plugin.builder"
import { DESK_LEGACY_CHAT } from "@tests/fixtures/builders/thread-desk-plugin.builder"
import {
    CONV,
    CORE,
    LEAD,
    WS,
    drain,
    itemsOf,
    processOf,
    refOf,
    startThread,
    stopsOf,
    threadDbOf,
    type ThreadDb,
} from "./thread-world"

// RULINGS R3 / R4 on the TEMPLATE road (`ctx.tools.call` → `ToolAnswer`), run by the REAL engine on threads (the thread compiler, the
// node host's template branch, the approvals of a thread run, the stops and the gate). Faked: the model (scripted), the outside world,
// and the node door, which behaves as the real door does (its own spec proves it): a tool the world asks about throws the typed approval
// ask unless the step carries the approval of exactly that call; a business refusal comes back as the refusal fact when the call asks
// for answers (`refusals: "answer"`) and is thrown otherwise; `not_connected` is thrown always.
jest.mock("@nivo-lite/plugin-registry", () => {
    const parts: typeof import("@tests/fixtures/builders/installation-parts.builder") = jest.requireActual(
        "@tests/fixtures/builders/installation-parts.builder",
    )
    const fixture: typeof import("@tests/fixtures/builders/template-refusal-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/template-refusal-plugin.builder",
    )
    // The world's desk beside it, for its one `defineNode` node (the old road, below).
    const desk: typeof import("@tests/fixtures/builders/thread-desk-plugin.builder") = jest.requireActual(
        "@tests/fixtures/builders/thread-desk-plugin.builder",
    )
    return { installed: parts.installationWith([fixture.TREF_PLUGIN, desk.DESK_PLUGIN], "template-refusals") }
})

/** How the world's door refuses a tool: a business code, or the infrastructure refusal `not_connected`. */
type Refusing = { readonly business: string } | "not_connected"

/** One call the door was asked, with how it asked for refusals. */
interface DoorCall {
    readonly tool: string
    readonly key: string
    readonly refusals: string | null
}

/** One call the door let through and acted on, once per call key: who approved it, if anyone. */
interface Acted {
    readonly tool: string
    readonly key: string
    readonly approvedBy: string | null
}

interface Door {
    readonly calls: Array<DoorCall>
    readonly acted: Array<Acted>
    readonly asks: Set<string>
    readonly refusing: Map<string, Refusing>
    readonly port: NodeToolDoor
}

const doorOf = (): Door => {
    const calls: Array<DoorCall> = []
    const acted: Array<Acted> = []
    const asks = new Set<string>()
    const refusing = new Map<string, Refusing>()
    const call = (asked: NodeToolCall): Promise<unknown> => {
        calls.push({ tool: asked.tool, key: asked.key, refusals: asked.refusals ?? null })
        const fingerprint = toolFingerprintOf(asked.tool, asked.args)
        if (asks.has(asked.tool) && asked.approval?.fingerprint !== fingerprint)
            return Promise.reject(
                new GraphNodesError({
                    code: GraphNodesErrorCode.ToolApprovalRequired,
                    params: {
                        tool: asked.tool,
                        fingerprint,
                        reason: "ask_mode",
                        args: JSON.stringify(asked.args),
                        call: JSON.stringify(asked.args),
                        key: asked.key,
                    },
                }),
            )
        const refused = refusing.get(asked.tool)
        if (refused === "not_connected")
            return Promise.reject(new GraphNodesError({ code: GraphNodesErrorCode.ToolNotConnected, params: { tool: asked.tool } }))
        if (refused !== undefined) {
            if (asked.refusals === "answer")
                return Promise.resolve({ kind: "refused", id: refused.business, facts: { tool: asked.tool } })
            return Promise.reject(
                new GraphNodesError({ code: GraphNodesErrorCode.ToolFailed, params: { tool: asked.tool, reason: "tool_error" } }),
            )
        }
        if (!acted.some((one) => one.key === asked.key && one.tool === asked.tool))
            acted.push({ tool: asked.tool, key: asked.key, approvedBy: asked.approval?.by ?? null })
        // The CRM's write answers what the OpenAPI connector answers (the response policy's REAL envelope, marked by the gateway), and
        // the template road reads it as the real door does (`templateValueOf`); any other road gets the envelope as it is.
        if (asked.tool === TREF_CRM_WRITE) {
            const result = crmSuccess()
            if (asked.refusals !== "answer") return Promise.resolve(result.value)
            const answered = templateValueOf(asked.tool, result, asked.account)
            return answered.kind === "value" ? Promise.resolve(answered.value) : Promise.reject(new Error("answer_unreadable"))
        }
        return Promise.resolve({ outcome: "filed" })
    }
    return { calls, acted, asks, refusing, port: { call } }
}

/** The CRM's body of the renewal it wrote (the fixture document's `service.renewal.create`, 201). */
const RENEWAL = { id: "r-1", state: "would_renew", dryRun: true }

/** The gateway's answer of the CRM write: the response policy's own envelope (body cut to the document), marked `envelope`. */
const crmSuccess = (): Extract<ToolCallResult, { ok: true }> => {
    const reading = readDocument(JSON.stringify(openApiFixture), "crm.nivoweb")
    const operation = reading.ok
        ? [...reading.document.operations.values()].find((one) => one.operationId === "service.renewal.create")
        : undefined
    if (operation === undefined) throw new Error("no renewal operation in the fixture document")
    const outcome = toolOutcomeOf(operation, 201, JSON.stringify(RENEWAL), { params: [], input: {}, dryRun: true, dryRunForced: true })
    if (outcome.kind !== "answer") throw new Error(`the envelope was refused: ${outcome.kind}`)
    return { ok: true, value: JSON.parse(JSON.stringify(outcome.value)), answers: "envelope" }
}

/** The report of the AI core for a step it cannot complete: it stops for the founder. */
const report = {
    decision: "report",
    reason: "Buoc nay khong the tiep tuc.",
    question: "Lam gi tiep?",
    suggestions: [
        { text: "Thu lai", handledBy: "workflow" },
        { text: "Bo qua", handledBy: "person" },
    ],
    customerLine: null,
}

const flowOf = (id: string): GraphSpec => {
    const graph = INSTALLED.templateOf(id)?.versions[0]?.graph
    if (graph === undefined) throw new Error(`no template ${id}`)
    return graph
}

const TRIGGER = { conversationId: CONV, leadId: LEAD, text: "Phi ship tang len 35k", channel: "zalo", locale: "vi" }

const started = async (db: ThreadDb, door: Door, id: string) => {
    const process = await processOf(db, { door: door.port })
    const woken = await startThread(process, { flow: flowOf(id), versionId: `${id}@1`, trigger: TRIGGER })
    expect(woken.error).toBeNull()
    return { process, runId: woken.runId ?? "" }
}

type Process = Awaited<ReturnType<typeof processOf>>

const stateOf = async (process: Process, runId: string) => (await process.threads.stateOf(refOf(runId))) ?? null

/** The run waits on one approval: the owner's item of the asked call and the step's approval stop. */
const asked = async (db: ThreadDb) => {
    const door = doorOf()
    door.asks.add(TREF_ASKED)
    const { process, runId } = await started(db, door, TREF_CONFIRM)
    expect(itemsOf(db)).toHaveLength(1)
    expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["confirm", "approval", "open"]])
    expect(door.acted).toEqual([])
    return { door, process, runId, workItemId: itemsOf(db)[0]?.item.id ?? "", from: db.wakes.length }
}

describe("a template node's call that asked a person (R3)", () => {
    it("declined: the node reads `declined`, takes its other route, the run completes, and the re-run asked nobody", async () => {
        const db = threadDbOf()
        const { door, process, runId, workItemId, from } = await asked(db)

        const decided = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "confirm", workItemId, verdict: "refused", by: "owner-1", text: "Khong duyet" },
            process.requests,
        )
        expect(decided).toMatchObject({ kind: "admitted" })
        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        const state = await stateOf(process, runId)
        expect(state?.status).toBe("ended")
        expect(state?.state.steps).toMatchObject({ confirm: { output: { route: "declined" } }, kept: { output: { outcome: "kept" } } })
        expect(state?.state.steps).not.toHaveProperty("filed")
        // Nothing acted, nobody was asked again (still the one item), and no failure reached the AI core.
        expect(door.acted).toEqual([])
        expect(itemsOf(db)).toHaveLength(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        expect((await stopsOf(process, runId)).map((stop) => [stop.kind, stop.state])).toEqual([["approval", "resolved"]])
        // The re-run made the same call (same fingerprint, same key) and the engine answered it without a new ask.
        const proposals = door.calls.filter((one) => one.tool === TREF_ASKED)
        expect(proposals).toHaveLength(2)
        expect(new Set(proposals.map((one) => one.key)).size).toBe(1)
    })

    it("approved: the approved call acts exactly once, with the approver, and the node takes its done route", async () => {
        const db = threadDbOf()
        const { door, process, runId, workItemId, from } = await asked(db)

        const decided = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "confirm", workItemId, verdict: "approved", by: "owner-1", text: "" },
            process.requests,
        )
        expect(decided).toMatchObject({ kind: "admitted" })
        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        const state = await stateOf(process, runId)
        expect(state?.status).toBe("ended")
        expect(state?.state.steps).toMatchObject({ confirm: { output: { route: "done" } }, filed: { output: { outcome: "filed" } } })
        expect(door.acted).toEqual([{ tool: TREF_ASKED, key: expect.stringContaining(":confirm:"), approvedBy: "owner-1" }])
        expect(itemsOf(db)).toHaveLength(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
    })

    it("the declined decision is kept where approvals live (the owner's item, the stop), never in the effect ledger", async () => {
        const db = threadDbOf()
        const { process, runId, workItemId } = await asked(db)
        const fingerprint = toolFingerprintOf(TREF_ASKED, TREF_PROPOSAL)
        const ref = refOf(runId)

        expect(await process.approvals?.declined(ref, "confirm", fingerprint)).toBe(false)
        await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "confirm", workItemId, verdict: "refused", by: "owner-1", text: "" },
            process.requests,
        )
        expect(await process.approvals?.declined(ref, "confirm", fingerprint)).toBe(true)
        expect(await process.approvals?.declined(ref, "confirm", "another-call")).toBe(false)
        expect(await process.approvals?.declined(ref, "another-step", fingerprint)).toBe(false)
    })
})

describe("a template node's native refusals (R4)", () => {
    it("a business refusal (`other_lead`) is a fact the node reads and routes on: the run completes, nothing freezes", async () => {
        const db = threadDbOf()
        const door = doorOf()
        door.refusing.set(TREF_READ, { business: "other_lead" })
        const { process, runId } = await started(db, door, TREF_LOOKUP)

        const state = await stateOf(process, runId)
        expect(state?.status).toBe("ended")
        expect(state?.state.steps).toMatchObject({ lookup: { output: { route: "elsewhere" } }, elsewhere: { output: { outcome: "elsewhere" } } })
        expect(await stopsOf(process, runId)).toEqual([])
        expect(db.model.askedOf(CORE)).toHaveLength(0)
        // The template road asked for refusals as answers.
        expect(door.calls.filter((one) => one.tool === TREF_READ).map((one) => one.refusals)).toEqual(["answer"])
    })

    it("`not_connected` never returns: the step freezes there and is reported", async () => {
        const db = threadDbOf()
        const door = doorOf()
        door.refusing.set(TREF_READ, "not_connected")
        db.model.script(CORE, report)
        const { process, runId } = await started(db, door, TREF_LOOKUP)

        expect((await stateOf(process, runId))?.status).toBe("stopped")
        expect((await stopsOf(process, runId)).map((stop) => stop.stepKey)).toEqual(["lookup"])
        expect(JSON.stringify(db.model.askedOf(CORE).at(0)?.request)).toContain(GraphNodesErrorCode.ToolNotConnected)
    })
})

describe("a template node reads an OpenAPI source's success as the source's BODY (fix 1)", () => {
    it("reads `value.id` of the CRM's write, the cut beside it in `meta`; the re-run after the approval replays the same unwrapped value", async () => {
        const db = threadDbOf()
        const door = doorOf()
        door.asks.add(TREF_ASKED)
        const { process, runId } = await started(db, door, TREF_CRM)
        // The write answered; the node then asked a person and stopped there.
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["write", "approval", "open"]])
        const workItemId = itemsOf(db)[0]?.item.id ?? ""
        const from = db.wakes.length

        const decided = await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "write", workItemId, verdict: "approved", by: "owner-1", text: "" },
            process.requests,
        )
        expect(decided).toMatchObject({ kind: "admitted" })
        const ran = await drain(process, from)

        expect(ran.map((one) => one.error)).toEqual([null])
        const state = await stateOf(process, runId)
        expect(state?.status).toBe("ended")
        // The body's members, never the envelope's (`ok`, `status`, `data`, `notice` are no member of what the node read).
        expect(state?.state.steps).toMatchObject({
            write: { output: { id: "r-1", state: "would_renew", truncated: false, route: "done" } },
            filed: { output: { outcome: "filed" } },
        })
        // The template road asked for answers on every call. The decision brings the thread back to the step (a new visit: nothing of
        // the earlier visit is replayed, `replay-ports.adapter.ts`), so the re-run asks the door for the write again, under the SAME call
        // key: the gateway's receipt of that key (`ToolRegistryService.guarded`) answers it without writing again, as the world's door
        // acts once per key. The CRM was written ONCE, and the re-run reads the same unwrapped value.
        const writes = door.calls.filter((one) => one.tool === TREF_CRM_WRITE)
        expect(writes.map((one) => one.refusals)).toEqual(["answer", "answer"])
        expect(new Set(writes.map((one) => one.key)).size).toBe(1)
        expect(door.acted.filter((one) => one.tool === TREF_CRM_WRITE)).toHaveLength(1)
        expect(db.model.askedOf(CORE)).toHaveLength(0)
    })

    it("the defineNode road of the same tool still receives the envelope as it is", async () => {
        const result = crmSuccess()

        expect(result.value).toMatchObject({ ok: true, status: 201, data: RENEWAL, truncated: false, omitted: 0, dryRun: true })
        expect(templateValueOf(TREF_CRM_WRITE, result)).toEqual({
            kind: "value",
            value: {
                ok: true,
                value: RENEWAL,
                via: { provider: null, connectionId: null },
                meta: {
                    status: 201,
                    truncated: false,
                    omitted: 0,
                    facts: expect.objectContaining({ dryRun: true, dryRunForced: true, notice: expect.any(String) }),
                },
            },
        })
    })
})

// The `defineNode` road is unchanged: the same "no" on a legacy step (a team-chat turn on that road: the shipped packages hold no
// `defineNode` business node any more, so the world desk's `wdesk.legacy-chat` is it) re-runs the step with the refusal in words, and the
// same call asked again is the step's trouble for the AI core, never an answer of the call.
const CHAT = DESK_LEGACY_CHAT
const ROOM = "6f1c2a10-3b4d-4e5f-8a9b-0c1d2e3f4a5b"
const ASKED_LINE = "0b8e7f2a-1c3d-4e5f-9a8b-7c6d5e4f3a2b"
const chatFlow: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: [] },
    grant: { tools: [TOOL.brainSearch, TOOL.brainChangePropose], effects: [TOOL.teamMessagePost] },
    nodes: [
        {
            key: "answer",
            kind: "output",
            step: "wdesk.legacy-chat",
            params: Object.fromEntries(
                ["roomId", "messageId", "text", "room", "intent", "asker", "lines", "locale"].map((name) => [name, { $ref: `trigger.${name}` }]),
            ),
        },
    ],
}
const PROPOSAL = { ...TREF_PROPOSAL, room: "direct", messageId: ASKED_LINE, quote: "Tu mai phi ship 35k" }
const proposes = { call: { tool: TOOL.brainChangePropose, args: PROPOSAL } }

describe("the defineNode road is unchanged by R3", () => {
    it("declined: the step runs again, the same call asks again and is the step's trouble (tool_approval_refused) for the AI core", async () => {
        const db = threadDbOf()
        db.rights.asks?.add(TOOL.brainChangePropose)
        db.model.script(CHAT, proposes, { done: { answer: "Da ghi nhan." } })
        const process = await processOf(db)
        const woken = await startThread(process, {
            flow: chatFlow,
            versionId: "chatbot-agent:team-chat@1",
            trigger: {
                roomId: ROOM,
                messageId: ASKED_LINE,
                text: "Tu mai phi ship 35k",
                room: "direct",
                intent: "answer",
                asker: { name: "Anh", standing: "owner" },
                lines: [],
                locale: "vi",
            },
        })
        const runId = woken.runId ?? ""
        const workItemId = itemsOf(db)[0]?.item.id ?? ""
        const from = db.wakes.length
        // Told no, this model would make the same call again: it is asked to, and the call is the step's trouble.
        db.model.script(CHAT, proposes, { done: { answer: "Da ghi nhan." } })
        db.model.script(CORE, report)

        await process.approvals?.decided(
            { workspaceId: WS, runId, stepKey: "answer", workItemId, verdict: "refused", by: "owner-1", text: "Khong" },
            process.requests,
        )
        await drain(process, from)

        expect(itemsOf(db)).toHaveLength(1)
        expect((db.rights.toolCalls ?? []).filter((one) => one.tool === TOOL.brainChangePropose)).toEqual([])
        expect(JSON.stringify(db.model.askedOf(CORE).at(0)?.request)).toContain("tool_approval_refused")
        // The step's one stop is now the AI core's report of that trouble (it took the place of the approval stop).
        expect((await stopsOf(process, runId)).map((stop) => [stop.stepKey, stop.kind, stop.state])).toEqual([["answer", "ai_report", "open"]])
        expect((await stateOf(process, runId))?.status).toBe("stopped")
    })
})
