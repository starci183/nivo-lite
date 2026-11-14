import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import {
    GRAPH_NODE_TOOL_DOOR,
    GraphNodeHostService,
    GraphNodeRunTokensService,
    GraphNodesError,
    GraphNodesErrorCode,
} from "@modules/domain/graph-nodes"
import type { NodeToolDoor, NodeTurn } from "@modules/domain/graph-nodes"
import { AgentAccountsService } from "@modules/domain/tools"
import type { ProviderBoard } from "@modules/domain/tools"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ApprovalItemsService } from "./stops/approval-items.service"
import { RunStopsError, RunStopsErrorCode } from "./stops/errors/run-stops.error"
import { RunStopRecordsService, type StopBuild } from "./stops/run-stop-records.service"
import { RunStopsService } from "./stops/run-stops.service"
import type { RunStop, StopOpen } from "./stops/run-stop.contracts"
import { ThreadApprovalsService, approvalAskOf, approvalKeyOf } from "./thread-approvals.service"
import type { ApprovalStep, ThreadResumer } from "./thread-approvals.service"

const NOW = "2026-11-12T08:00:00.000Z"
const REF = { workspaceId: "ws-1", runId: "run-1" }
const FINGERPRINT = "f".repeat(64)
const KEY = `${approvalKeyOf("run-1", "qr")}:${FINGERPRINT}`

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "vi",
}

/** Facts of a stop from name and value pairs. */
const factsOf = (...pairs: ReadonlyArray<readonly [string, string]>) => pairs.map(([name, value]) => ({ name, value }))

const STEP: ApprovalStep = {
    workspaceId: "ws-1",
    runId: "run-1",
    stepKey: "qr",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: "lead-1",
    turn: TURN,
    card: {
        locale: "vi",
        workflow: { moduleKey: "sales", key: "order", title: "Orders" },
        step: { key: "qr", nodeId: "sales.payment-qr", title: "Make QR" },
        by: "ai",
    },
}

/** The host's typed refusal of a call of `nivo.tool.payment.transfer.create` an `ask` tick holds. */
const askError = (params: Record<string, unknown> = {}): GraphNodesError =>
    new GraphNodesError({
        code: GraphNodesErrorCode.ToolApprovalRequired,
        params: { tool: "nivo.tool.payment.transfer.create", fingerprint: FINGERPRINT, reason: "ask_mode", ...params },
    })

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "approve_tool_call",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "waiting_decision",
    decided_path: null,
    reason: "branch_ask",
    reasons: [],
    missing_fields: [],
    proposal: { summary: "The AI needs your approval", fields: { engine: "langgraph", fingerprint: FINGERPRINT } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: "inst-1",
})

const stopOf = (over: Partial<RunStop> = {}): RunStop => ({
    id: "stop-1",
    version: "1",
    runId: "run-1",
    stepKey: "qr",
    agentId: "agent-1",
    workflowId: "wf-1",
    contactId: "lead-1",
    conversationId: "conv-1",
    kind: "approval",
    state: "open",
    reason: "The AI needs your approval",
    question: null,
    detail: {
        suggestions: [],
        facts: factsOf(["tool", "nivo.tool.payment.transfer.create"], ["workItemId", "item-1"], ["fingerprint", FINGERPRINT]),
    },
    cardMessageId: "msg-1",
    customerLines: [],
    answers: [],
    decision: null,
    repeats: 1,
    stoppedAt: NOW,
    resolvedAt: null,
    ...over,
})

const BOARD: ProviderBoard = {
    providers: [
        {
            provider: "sepay",
            label: { vi: "SePay", en: "SePay" },
            kind: "payment",
            kindLabel: { vi: "Payment (vi)", en: "Payment" },
            connected: true,
            abilities: [
                {
                    id: "qr.create",
                    label: { vi: "Create a payment QR (vi)", en: "Create a payment QR" },
                    scope: "write",
                    tools: ["nivo.tool.payment.transfer.create"],
                },
            ],
            accounts: [
                { connectionId: "conn-1", provider: "sepay", label: "MB Bank 5252", connected: true },
            ],
        },
    ],
    attachments: [{ agentId: "agent-1", connectionId: "conn-1", provider: "sepay" }],
}

interface Options {
    readonly stop?: RunStop | null
    readonly existing?: WorkItem | null
    readonly latest?: WorkItem | null
    readonly raise?: "ok" | "throws"
    /** The item found by its id (the item an approval stop names); defaults to `existing`. */
    readonly byId?: WorkItem | null
    /** The engine's model door's answer to the card's brief: words, a failure, or no door at all (absent). */
    readonly brief?: { readonly text: string } | "fails"
}

const build = async (options: Options = {}) => {
    let stop = options.stop === undefined ? null : options.stop
    const stops = mock<RunStopsService>({
        stopOf: jest.fn(() => Promise.resolve(stop)),
        stopped: jest.fn((input: StopOpen) => {
            stop = stopOf({ kind: input.kind, detail: { suggestions: [], facts: [...input.facts] } })
            return Promise.resolve({
                stopId: "stop-1",
                runId: input.runId,
                stepKey: input.stepKey,
                kind: input.kind,
                reason: input.reason,
                question: input.question,
            })
        }),
    })
    const records = mock<RunStopRecordsService>({
        patch: jest.fn((_ws: string, _id: string, make: StopBuild) => {
            if (stop === null) return Promise.resolve(null)
            const values = make(stop)
            if (values === null) return Promise.resolve(null)
            stop = { ...stop, ...values }
            return Promise.resolve(stop)
        }),
    })
    const byId = options.byId === undefined ? options.existing : options.byId
    const items = mock<WorkItemsService>({
        insert: jest.fn(async () => {
            await Promise.resolve()
            if (options.raise === "throws") throw new RunStopsError({ code: RunStopsErrorCode.Contended })
            return itemOf({ id: "item-1", status: "queued" })
        }),
        markWaiting: jest.fn().mockResolvedValue(itemOf({ id: "item-1" })),
        // The guarded take: only an item still waiting is taken (a person's decision meanwhile leaves nothing to take).
        reopen: jest.fn().mockResolvedValue(byId?.status === "waiting_decision" ? { ...byId, status: "queued" } : null),
        markDone: jest.fn().mockResolvedValue(itemOf({ status: "done" })),
        markRejected: jest.fn().mockResolvedValue(itemOf({ status: "rejected" })),
        markFailed: jest.fn().mockResolvedValue(itemOf({ status: "failed" })),
        findByDedupe: jest.fn().mockResolvedValue(options.existing ?? null),
        latestOfKey: jest.fn().mockResolvedValue(options.latest ?? null),
        findMany: jest.fn().mockResolvedValue(
            [byId].filter((item): item is WorkItem => item !== undefined && item !== null),
        ),
    })
    const door = mock<NodeToolDoor>({
        call: jest.fn().mockResolvedValue({ outcome: "filed", changeRequest: { id: "cr-1" } }),
        run: undefined,
    })
    const tokens = mock<GraphNodeRunTokensService>({ mint: jest.fn().mockReturnValue("token-1") })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue({ moduleKey: "sales" }),
    })
    const abilities = mock<AgentAccountsService>({
        boundAccountsOf: jest.fn().mockResolvedValue([{ provider: "sepay", connectionId: "conn-1" }]),
        board: jest.fn().mockResolvedValue(BOARD),
    })
    const runs = mock<ThreadResumer>({ resume: jest.fn().mockResolvedValue({ kind: "admitted", fresh: true }) })
    const brief = options.brief
    const host = brief === undefined ? null : mock<GraphNodeHostService>()
    if (host !== null && brief === "fails") host.core.mockRejectedValue(new Error("model down"))
    if (host !== null && brief !== "fails" && brief !== undefined) host.core.mockResolvedValue(brief)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadApprovalsService,
            ApprovalItemsService,
            { provide: RunStopsService, useValue: stops },
            { provide: RunStopRecordsService, useValue: records },
            { provide: WorkItemsService, useValue: items },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentAccountsService, useValue: abilities },
            { provide: GRAPH_NODE_TOOL_DOOR, useValue: door },
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: CLOCK, useValue: new FakeClock(new Date(NOW)) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
            ...(host === null ? [] : [{ provide: GraphNodeHostService, useValue: host }]),
        ],
    }).compile()
    const current = (): RunStop | null => stop
    return { service: moduleRef.get(ThreadApprovalsService), stops, items, abilities, runs, door, current, host }
}

describe("ThreadApprovalsService.asked", () => {
    it("raises ONE owner item for the exact call, with no line of its own, and opens the approval stop that names tool, account and arguments", async () => {
        const { service, items, stops } = await build()

        const asked = await service.asked(STEP, askError({ args: JSON.stringify({ orderId: "DH-1", amountVnd: "25000" }) }))

        expect(asked).toMatchObject({
            kind: "stopped",
            workItemId: "item-1",
            question: { kind: "approval", stepKey: "qr" },
        })
        expect(items.insert).toHaveBeenCalledTimes(1)
        const [raised] = items.insert.mock.calls[0] ?? []
        expect(raised).toMatchObject({
            workspaceId: "ws-1",
            action: "approve_tool_call",
            department: "sales",
            subjectType: "conversation",
            subjectId: "conv-1",
            leadId: null,
            dedupeKey: KEY,
            chainId: null,
            parentId: null,
            proposal: {
                fields: {
                    engine: "langgraph",
                    runId: "run-1",
                    stepKey: "qr",
                    tool: "nivo.tool.payment.transfer.create",
                    fingerprint: FINGERPRINT,
                    account: "SePay · MB Bank 5252",
                    connectionId: "conn-1",
                    args: "orderId: DH-1\namountVnd: 25000",
                },
            },
        })
        // The item waits for a person, always: the reason a node on `ask` gives (no gate of an old engine decides it).
        expect(items.markWaiting).toHaveBeenCalledWith("item-1", {
            reason: "branch_ask",
            reasons: ["branch_ask"],
            missing: [],
            proposal: expect.objectContaining({ summary: expect.any(String) }),
            executionId: null,
        })
        const [opened] = stops.stopped.mock.calls[0] ?? []
        expect(opened).toMatchObject({
            kind: "approval",
            runId: "run-1",
            stepKey: "qr",
            conversationId: "conv-1",
            contactId: "lead-1",
        })
        expect(opened?.facts).toEqual([
            { name: "tool", value: "nivo.tool.payment.transfer.create" },
            { name: "account", value: "SePay · MB Bank 5252" },
            { name: "ability", value: "Create a payment QR (vi)" },
            { name: "orderId", value: "DH-1" },
            { name: "amountVnd", value: "25000" },
            { name: "workItemId", value: "item-1" },
            { name: "fingerprint", value: FINGERPRINT },
        ])
    })

    it("asks again on the item already waiting (a word or a retry on the card), never a second item", async () => {
        const { service, items, stops } = await build({ existing: itemOf({ id: "item-1" }), stop: stopOf() })

        const asked = await service.asked(STEP, askError())

        expect(asked).toMatchObject({ kind: "stopped", workItemId: "item-1" })
        expect(items.insert).not.toHaveBeenCalled()
        expect(stops.stopped).toHaveBeenCalledTimes(1)
    })
})

describe("ThreadApprovalsService.asked, when the step must not wait", () => {
    it("is the step's trouble when a person refused this exact call: closed refused, or refused on the stop while the item is still closing", async () => {
        const closed = await build({ existing: itemOf({ status: "rejected" }) })
        const refusedOnStop = await build({
            existing: itemOf(),
            stop: stopOf({
                detail: { suggestions: [], facts: factsOf(["workItemId", "item-1"], ["verdict", "refused"]) },
            }),
        })
        const failed = await build({ existing: itemOf({ status: "failed" }) })

        for (const world of [closed, refusedOnStop, failed]) {
            expect(await world.service.asked(STEP, askError())).toMatchObject({
                kind: "trouble",
                code: "tool_approval_refused",
            })
            expect(world.stops.stopped).not.toHaveBeenCalled()
            expect(world.items.insert).not.toHaveBeenCalled()
        }
    })

    it("is the step's trouble when the call was approved once already and still asks", async () => {
        const { service, stops } = await build({ existing: itemOf({ status: "done" }) })

        expect(await service.asked(STEP, askError())).toMatchObject({ kind: "trouble", code: "tool_approval_spent" })
        expect(stops.stopped).not.toHaveBeenCalled()
    })

    it("is the step's trouble when the approval kept on the stop did not let the call through (the item still closing)", async () => {
        const { service, stops } = await build({
            existing: itemOf(),
            stop: stopOf({
                detail: {
                    suggestions: [],
                    facts: factsOf(["workItemId", "item-1"], ["verdict", "approved:member-owner"]),
                },
            }),
        })

        expect(await service.asked(STEP, askError())).toMatchObject({ kind: "trouble", code: "tool_approval_spent" })
        expect(stops.stopped).not.toHaveBeenCalled()
    })

    it("is the step's trouble when the error names no call or the item cannot be raised", async () => {
        const unreadable = await build()
        const unraised = await build({ raise: "throws" })

        const unread = await unreadable.service.asked(STEP, askError({ fingerprint: undefined }))
        const unavailable = await unraised.service.asked(STEP, askError())
        expect(unread).toMatchObject({ kind: "trouble", code: "tool_approval_unreadable" })
        expect(approvalAskOf(new GraphNodesError({ code: GraphNodesErrorCode.ToolNotGranted }))).toBeNull()
        expect(unavailable).toMatchObject({ kind: "trouble", code: "tool_approval_unavailable" })
        expect(unraised.stops.stopped).not.toHaveBeenCalled()
    })
})

describe("ThreadApprovalsService.asked, the words of the card", () => {
    it("binds the card's account as the asking step's call when the turn names its workflow step, and as before when it names none", async () => {
        const { service, abilities } = await build()
        const step = { nodeKey: "send-qr", versionId: "v-7", workflowId: "wf-consult" }

        await service.asked({ ...STEP, turn: { ...STEP.turn, step } }, askError({ args: { orderId: "order-1" } }))
        await service.asked(STEP, askError({ args: { orderId: "order-2" } }))

        const seens = abilities.boundAccountsOf.mock.calls.map((call) => call[3])
        expect(seens).toEqual([{ origin: "approval_card", node: step }, { origin: "approval_card" }])
    })

    it("names the tool alone when the call takes no account, and renames an argument named like an engine fact", async () => {
        const { service, abilities, stops, items } = await build()
        abilities.boundAccountsOf.mockResolvedValue([])

        await service.asked({ ...STEP, contactId: null }, askError({ args: { tool: "x" } }))

        const [opened] = stops.stopped.mock.calls[0] ?? []
        expect(opened?.facts.map((fact) => fact.name)).toEqual(["tool", "arg.tool", "workItemId", "fingerprint"])
        expect(items.insert.mock.calls[0]?.[0]).toMatchObject({ subjectType: "conversation", subjectId: "conv-1", leadId: null })
    })
})

describe("ThreadApprovalsService.asked, the approval card the engine builds before the write (team-chat rule 9)", () => {
    const CALL = JSON.stringify({ orderNo: "DH-7", amountVnd: 250000 })

    it("names the step, the call on the account the runner picked, the facts from the REAL arguments, and the AI's brief", async () => {
        const { service, stops, host } = await build({ brief: { text: "  Tạo mã QR 250.000đ cho đơn DH-7.  " } })

        await service.asked(STEP, askError({ call: CALL, key: "k-1", args: JSON.stringify({ orderNo: "words" }) }))

        const card = stops.stopped.mock.calls[0]?.[0].approvalCard
        expect(card).toEqual({
            step: { nodeId: "sales.payment-qr", title: "Make QR", description: "" },
            // The "Thao tac" row's words: the tool's declared title (its plugin's tool label), never the raw id alone.
            call: {
                tool: "nivo.tool.payment.transfer.create",
                account: "SePay · MB Bank 5252",
                label: { vi: "Tạo thông tin chuyển khoản", en: "Create a bank-transfer instruction" },
            },
            facts: [
                { name: "orderNo", value: "DH-7" },
                { name: "amountVnd", value: "250000" },
            ],
            text: "Tạo mã QR 250.000đ cho đơn DH-7.",
        })
        expect(host?.core.mock.calls[0]?.[1]).toMatchObject({ purpose: "engine:approval-brief" })
    })

    it("posts with the engine's fallback words when the AI fails, answers nothing, or no model door is bound", async () => {
        for (const brief of ["fails", { text: "   " }, undefined] as const) {
            const { service, stops } = await build(brief === undefined ? {} : { brief })

            expect(await service.asked(STEP, askError({ call: CALL, key: "k-1" }))).toMatchObject({ kind: "stopped" })
            expect(stops.stopped.mock.calls[0]?.[0].approvalCard?.text).toBe("[agentGraphs.toolApproval.brief]")
        }
    })

    it("carries the content a person approves IN FULL beside the short facts: a 2,000-character text is whole on the card, cut to 400 only as a fact", async () => {
        const { service, stops } = await build()
        const text = "Dạ chị ơi, đơn của chị đã xong. ".repeat(70).slice(0, 2000)
        const content = JSON.stringify([
            { name: "text", kind: "text", value: text },
            { name: "images", kind: "address", value: "https://img.example/qr.png" },
        ])

        await service.asked(STEP, askError({ call: JSON.stringify({ text }), key: "k-1", args: JSON.stringify({ text }), content }))

        const card = stops.stopped.mock.calls[0]?.[0].approvalCard
        expect(card?.content).toEqual([
            { name: "text", kind: "text", value: text },
            { name: "images", kind: "address", value: "https://img.example/qr.png" },
        ])
        expect(card?.content?.[0]?.value).toHaveLength(2000)
        expect(card?.facts).toHaveLength(1)
        expect(card?.facts[0]?.value.length).toBeLessThanOrEqual(400)
        expect(card?.facts[0]?.value).not.toBe(text)
    })

    it("posts the card with its facts alone when the content param is absent or unreadable", async () => {
        const { service, stops } = await build()

        await service.asked(STEP, askError({ call: CALL, key: "k-1", content: "not json" }))

        expect(stops.stopped.mock.calls[0]?.[0].approvalCard?.content).toBeUndefined()
    })

    it("drops a preview of no registered kind (or one failing its schema) and still posts the card", async () => {
        const { service, stops } = await build()
        const preview = JSON.stringify({ kind: "nobody.kind", payload: { orderNo: 7 } })

        expect(await service.asked(STEP, askError({ call: CALL, key: "k-1", preview }))).toMatchObject({ kind: "stopped" })
        const card = stops.stopped.mock.calls[0]?.[0].approvalCard
        expect(card).toBeDefined()
        expect(card?.preview).toBeUndefined()
    })
})

describe("ThreadApprovalsService.decided", () => {
    it("an owner's approval is kept on the stop BEFORE the thread is woken with a retry by that owner", async () => {
        const { service, runs, current } = await build({ stop: stopOf() })
        runs.resume.mockImplementation(() => {
            expect(current()?.detail.facts).toContainEqual({ name: "verdict", value: "approved:member-owner" })
            return Promise.resolve({ kind: "admitted", fresh: true })
        })

        const decided = await service.decided(
            { ...REF, stepKey: "qr", workItemId: "item-1", verdict: "approved", by: "member-owner", text: "" },
            runs,
        )

        expect(decided).toEqual({ kind: "admitted", fresh: true })
        expect(runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, { kind: "retry", by: "member-owner", at: NOW })
    })

    it("a person's refusal wakes the thread with the refusal in words; the deadline's with a timeout", async () => {
        const person = await build({ stop: stopOf() })
        const deadline = await build({ stop: stopOf() })

        await person.service.decided(
            { ...REF, stepKey: "qr", workItemId: "item-1", verdict: "refused", by: "member-2", text: "Not allowed" },
            person.runs,
        )
        await deadline.service.decided(
            { ...REF, stepKey: "qr", workItemId: "item-1", verdict: "refused", by: null, text: "" },
            deadline.runs,
        )

        expect(person.runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, {
            kind: "answer",
            text: "Not allowed",
            by: "member-2",
            at: NOW,
        })
        expect(person.current()?.detail.facts).toContainEqual({ name: "verdict", value: "refused" })
        expect(deadline.runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, { kind: "timeout", at: NOW })
    })

    it("hands nothing to a run that no longer waits on this item", async () => {
        const gone = await build({ stop: null })
        const resolved = await build({ stop: stopOf({ state: "resolved" }) })
        const report = await build({ stop: stopOf({ kind: "ai_report" }) })
        const stale = await build({ stop: stopOf() })
        const verdict = { ...REF, stepKey: "qr", workItemId: "item-1", verdict: "approved" as const, by: "m", text: "" }

        expect(await gone.service.decided(verdict, gone.runs)).toEqual({ kind: "refused", code: "thread_not_waiting" })
        expect(await resolved.service.decided(verdict, resolved.runs)).toEqual({
            kind: "refused",
            code: "thread_not_waiting",
        })
        expect(await report.service.decided(verdict, report.runs)).toEqual({
            kind: "refused",
            code: "thread_not_waiting",
        })
        expect(await stale.service.decided({ ...verdict, workItemId: "item-9" }, stale.runs)).toEqual({
            kind: "refused",
            code: "approval_stale",
        })
        expect(await stale.service.decided({ ...verdict, by: null }, stale.runs)).toEqual({
            kind: "refused",
            code: "approver_unknown",
        })
        for (const world of [gone, resolved, report, stale]) expect(world.runs.resume).not.toHaveBeenCalled()
    })
})

describe("ThreadApprovalsService.approvalOf", () => {
    it("carries the owner's verdict kept on the open approval stop: exactly the call shown", async () => {
        const { service, items } = await build({
            stop: stopOf({
                detail: {
                    suggestions: [],
                    facts: factsOf(
                        ["workItemId", "item-1"],
                        ["fingerprint", FINGERPRINT],
                        ["verdict", "approved:member-owner"],
                    ),
                },
            }),
        })

        expect(await service.approvalOf(REF, "qr")).toEqual({ by: "member-owner", fingerprint: FINGERPRINT })
        expect(items.latestOfKey).not.toHaveBeenCalled()
    })

    it("after a later stop of another kind, carries the approved item of the step, by its decider", async () => {
        const { service, items } = await build({
            stop: stopOf({ kind: "ai_report", detail: { suggestions: [], facts: [] } }),
            latest: itemOf({
                status: "done",
                proposal: {
                    summary: "x",
                    fields: { engine: "langgraph", fingerprint: FINGERPRINT, approvedBy: "member-owner" },
                },
            }),
        })

        expect(await service.approvalOf(REF, "qr")).toEqual({ by: "member-owner", fingerprint: FINGERPRINT })
        expect(items.latestOfKey).toHaveBeenCalledWith("ws-1", "approve_tool_call", approvalKeyOf("run-1", "qr"))
    })

    it("carries nothing for a step never asked about, a refused stop, or an item not approved", async () => {
        const never = await build({ stop: null })
        const refused = await build({ stop: stopOf(), latest: itemOf({ status: "rejected" }) })
        const waiting = await build({ stop: stopOf(), latest: itemOf() })

        expect(await never.service.approvalOf(REF, "qr")).toBeNull()
        expect(never.items.latestOfKey).not.toHaveBeenCalled()
        expect(await refused.service.approvalOf(REF, "qr")).toBeNull()
        expect(await waiting.service.approvalOf(REF, "qr")).toBeNull()
    })
})

describe("ThreadApprovalsService.expired", () => {
    it("takes the waiting item, wakes the thread with a timeout and closes the item refused by the engine", async () => {
        const { service, items, runs } = await build({ stop: stopOf(), existing: itemOf() })

        expect(await service.expired(REF, "qr", runs)).toEqual({ kind: "admitted", fresh: true })
        expect(items.reopen).toHaveBeenCalledWith("ws-1", "item-1")
        expect(runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, { kind: "timeout", at: NOW })
        expect(items.markRejected).toHaveBeenCalledTimes(1)
        expect(items.markRejected.mock.calls[0]?.[0]).toBe("item-1")
    })

    it("wakes the thread with a timeout itself when the item no longer waits, and does nothing without an open approval stop", async () => {
        const failed = await build({ stop: stopOf(), existing: itemOf({ status: "failed" }) })
        const none = await build({ stop: stopOf({ kind: "ai_error" }) })

        expect(await failed.service.expired(REF, "qr", failed.runs)).toEqual({ kind: "admitted", fresh: true })
        expect(failed.runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, { kind: "timeout", at: NOW })
        expect(failed.items.reopen).not.toHaveBeenCalled()
        expect(failed.items.markRejected).not.toHaveBeenCalled()
        expect(await none.service.expired(REF, "qr", none.runs)).toBeNull()
    })

    it("leaves the thread to a person's decision that took the item while the deadline ran", async () => {
        const { service, items, runs } = await build({ stop: stopOf(), existing: itemOf() })
        items.reopen.mockResolvedValue(null)

        expect(await service.expired(REF, "qr", runs)).toMatchObject({ kind: "refused", code: "decided_meanwhile" })
        expect(runs.resume).not.toHaveBeenCalled()
        expect(items.markRejected).not.toHaveBeenCalled()
    })
})

describe("ThreadApprovalsService.verdict", () => {
    const OWNER = { workspaceId: "ws-1", workItemId: "item-1", by: "member-owner", owner: true, locale: "vi" } as const
    const threadItem = (status: WorkItem["status"] = "waiting_decision") =>
        itemOf({
            status,
            proposal: {
                summary: "x",
                fields: { engine: "langgraph", runId: "run-1", stepKey: "qr", tool: "nivo.tool.payment.transfer.create" },
            },
        })

    it("the owner's approval takes the item, keeps the verdict on the stop, wakes the thread and closes the item done by that owner", async () => {
        const { service, items, runs, current } = await build({ stop: stopOf(), existing: threadItem() })

        const outcome = await service.verdict({ ...OWNER, verdict: "approved" }, runs)

        expect(outcome).toEqual({ kind: "decided", workItemId: "item-1", status: "done" })
        expect(current()?.detail.facts).toContainEqual({ name: "verdict", value: "approved:member-owner" })
        expect(runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, { kind: "retry", by: "member-owner", at: NOW })
        expect(items.markDone.mock.calls[0]?.[0]).toBe("item-1")
        expect(items.markDone.mock.calls[0]?.[1]).toMatchObject({
            path: "human",
            proposal: { fields: { approvedBy: "member-owner" } },
        })
    })

    it("a refusal by a member who is not the owner wakes the thread with the refusal in words and closes the item refused", async () => {
        const { service, items, runs } = await build({ stop: stopOf(), existing: threadItem() })

        const outcome = await service.verdict({ ...OWNER, by: "member-2", owner: false, verdict: "refused" }, runs)

        expect(outcome).toEqual({ kind: "decided", workItemId: "item-1", status: "rejected" })
        expect(runs.resume).toHaveBeenCalledWith({ ...REF, stepKey: "qr" }, {
            kind: "answer",
            text: "[performers.toolApprovalRefused]",
            by: "member-2",
            at: NOW,
        })
        expect(items.markRejected).toHaveBeenCalledTimes(1)
        expect(items.markDone).not.toHaveBeenCalled()
    })

    it("refuses an approval by anyone but the owner with the item left waiting, and nothing handed to the thread", async () => {
        const { service, items, runs } = await build({ stop: stopOf(), existing: threadItem() })

        expect(await service.verdict({ ...OWNER, owner: false, verdict: "approved" }, runs)).toEqual({
            kind: "refused",
            code: "not_owner",
        })
        expect(items.reopen).not.toHaveBeenCalled()
        expect(runs.resume).not.toHaveBeenCalled()
    })

    it("refuses an item that is no thread approval, one that no longer waits, and one a second verdict took first", async () => {
        const other = await build({ stop: stopOf(), existing: itemOf({ action: "send_email" }) })
        const old = await build({ stop: stopOf(), existing: itemOf() })
        const closed = await build({ stop: stopOf(), existing: threadItem("done") })
        const raced = await build({ stop: stopOf(), existing: threadItem() })
        raced.items.reopen.mockResolvedValue(null)

        expect(await other.service.verdict({ ...OWNER, verdict: "approved" }, other.runs)).toEqual({
            kind: "refused",
            code: "not_found",
        })
        expect(await old.service.verdict({ ...OWNER, verdict: "approved" }, old.runs)).toEqual({
            kind: "refused",
            code: "not_found",
        })
        expect(await closed.service.verdict({ ...OWNER, verdict: "approved" }, closed.runs)).toEqual({
            kind: "refused",
            code: "not_waiting",
        })
        expect(await raced.service.verdict({ ...OWNER, verdict: "approved" }, raced.runs)).toEqual({
            kind: "refused",
            code: "not_waiting",
        })
        for (const world of [other, old, closed, raced]) expect(world.runs.resume).not.toHaveBeenCalled()
    })

    it("an approval the run no longer waits on closes the item failed: it does not pass", async () => {
        const { service, items, runs } = await build({ stop: stopOf({ state: "resolved" }), existing: threadItem() })

        expect(await service.verdict({ ...OWNER, verdict: "approved" }, runs)).toEqual({
            kind: "refused",
            code: "thread_not_waiting",
        })
        expect(items.markFailed).toHaveBeenCalledWith("item-1", "thread_not_waiting")
        expect(items.markDone).not.toHaveBeenCalled()
        expect(runs.resume).not.toHaveBeenCalled()
    })
})

// FX4 (D-P11-5): the owner approved; the model, asked again, rewrote its words and the approval (bound to the exact arguments) asked
// again: a loop. Now the item keeps the exact call, the ENGINE runs it once through the host's door under its own key, and a second
// ask of the same tool in the step is one trouble (one report), never a second item.
describe("ThreadApprovalsService: the approved call runs once, by the engine", () => {
    const CALL = JSON.stringify({ subject: "Giao hang", attribute: "Phi ship noi thanh", value: "35.000 d" })
    const CALL_KEY = "run-1:qr:tool:abc"
    const PROPOSE = "nivo.tool.brain.change.propose"
    const approvedItem = (status: WorkItem["status"]) =>
        itemOf({
            status,
            proposal: {
                summary: "x",
                fields: {
                    engine: "langgraph",
                    tool: PROPOSE,
                    fingerprint: FINGERPRINT,
                    call: CALL,
                    callKey: CALL_KEY,
                    // Who approved, as the approval door's close keeps it on the item.
                    approvedBy: "member-owner",
                },
            },
        })
    const approvedStop = stopOf({
        detail: {
            suggestions: [],
            facts: factsOf(
                ["tool", PROPOSE],
                ["workItemId", "item-1"],
                ["fingerprint", FINGERPRINT],
                ["verdict", "approved:member-owner"],
            ),
        },
    })

    it("keeps the exact call of the ask on the owner's item (its arguments as JSON text and its key)", async () => {
        const { service, items } = await build()

        await service.asked(STEP, askError({ call: CALL, key: CALL_KEY }))

        expect(items.insert.mock.calls[0]?.[0]).toMatchObject({ proposal: { fields: { call: CALL, callKey: CALL_KEY } } })
    })

    it("runs exactly the approved call through the door, under its key and the approval, and words its answer for the model", async () => {
        const { service, door } = await build({ stop: approvedStop, byId: approvedItem("waiting_decision") })

        const run = await service.approvedRun(REF, "qr", TURN)

        expect(door.call).toHaveBeenCalledTimes(1)
        expect(door.call).toHaveBeenCalledWith({
            token: "token-1",
            tool: PROPOSE,
            args: JSON.parse(CALL),
            key: CALL_KEY,
            approval: { by: "member-owner", fingerprint: FINGERPRINT },
        })
        expect(run.approval).toEqual({ by: "member-owner", fingerprint: FINGERPRINT })
        expect(run.answer).toMatchObject({ by: "engine", at: NOW })
        expect(run.answer?.text).toContain("35.000 d")
        expect(run.answer?.text).toContain("filed")
        expect(run.answer?.text).toContain(`do not call ${PROPOSE} again`)
    })

    it("a later run of the step runs the same call again under the same key (the door's receipt answers it once), from the done item", async () => {
        const { service, door } = await build({ stop: stopOf({ kind: "ai_report" }), latest: approvedItem("done") })

        const run = await service.approvedRun(REF, "qr", TURN)

        expect(door.call.mock.calls[0]?.[0]).toMatchObject({ key: CALL_KEY, approval: { by: "member-owner" } })
        expect(run.answer).not.toBeNull()
    })

    it("runs nothing for an effect's right (no call kept), nor for a step nobody approved", async () => {
        const effect = await build({ stop: approvedStop, byId: itemOf() })
        const never = await build()

        expect(await effect.service.approvedRun(REF, "qr", TURN)).toEqual({
            approval: { by: "member-owner", fingerprint: FINGERPRINT },
            answer: null,
        })
        expect(await never.service.approvedRun(REF, "qr", TURN)).toEqual({ approval: null, answer: null })
        expect(effect.door.call).not.toHaveBeenCalled()
        expect(never.door.call).not.toHaveBeenCalled()
    })

    it("a replay of the same tool with arguments other than the approved ones raises a NEW card, never runs them (rights 11d)", async () => {
        const { service, items, stops, door } = await build({ stop: approvedStop, latest: approvedItem("done") })
        const other = "e".repeat(64)

        const asked = await service.asked(STEP, askError({ tool: PROPOSE, fingerprint: other, call: "{\"value\":\"40.000 d\"}", key: "k-2" }))

        expect(asked).toMatchObject({ kind: "stopped" })
        expect(items.insert).toHaveBeenCalledTimes(1)
        expect(items.insert.mock.calls[0]?.[0]).toMatchObject({ dedupeKey: `${approvalKeyOf("run-1", "qr")}:${other}` })
        expect(stops.stopped).toHaveBeenCalledTimes(1)
        expect(stops.stopped.mock.calls[0]?.[0].approvalCard?.facts).toEqual([{ name: "value", value: "40.000 d" }])
        expect(door.call).not.toHaveBeenCalled()
    })

    it("answers the approval a person gave in this step to exactly that fingerprint, and none to another", async () => {
        const kept = await build({ stop: approvedStop, existing: approvedItem("waiting_decision") })
        const done = await build({ existing: approvedItem("done") })
        const waiting = await build({ existing: itemOf() })
        const none = await build()

        await expect(kept.service.approvedFor(REF, "qr", FINGERPRINT)).resolves.toEqual({ by: "member-owner", fingerprint: FINGERPRINT })
        await expect(done.service.approvedFor(REF, "qr", FINGERPRINT)).resolves.toEqual({ by: "member-owner", fingerprint: FINGERPRINT })
        await expect(waiting.service.approvedFor(REF, "qr", FINGERPRINT)).resolves.toBeNull()
        await expect(none.service.approvedFor(REF, "qr", FINGERPRINT)).resolves.toBeNull()
    })

    it("control: another tool of the same step still asks as usual", async () => {
        const { service, items } = await build({ latest: approvedItem("done") })

        expect(await service.asked(STEP, askError({ fingerprint: "e".repeat(64) }))).toMatchObject({ kind: "stopped" })
        expect(items.insert).toHaveBeenCalledTimes(1)
    })
})

// FX4 (D-P11-6): a stop closed another way withdraws its item, keeping the verdict `withdrawn` first: the item's late verdict moves nothing.
describe("ThreadApprovalsService: a withdrawn approval", () => {
    const withdrawn = stopOf({
        detail: {
            suggestions: [],
            facts: factsOf(["workItemId", "item-1"], ["fingerprint", FINGERPRINT], ["verdict", "withdrawn"]),
        },
    })

    it("hands nothing to the thread when the item is decided after its stop withdrew it", async () => {
        const { service, runs } = await build({ stop: withdrawn })

        const decided = await service.decided(
            { ...REF, stepKey: "qr", workItemId: "item-1", verdict: "refused", by: null, text: "" },
            runs,
        )

        expect(decided).toEqual({ kind: "refused", code: "approval_stale" })
        expect(runs.resume).not.toHaveBeenCalled()
    })

    it("the same call asked again after the withdrawal is the step's trouble, never a second item", async () => {
        const { service, items } = await build({ stop: withdrawn, existing: itemOf({ status: "rejected" }) })

        expect(await service.asked(STEP, askError())).toMatchObject({ kind: "trouble", code: "tool_approval_withdrawn" })
        expect(items.insert).not.toHaveBeenCalled()
    })
})
