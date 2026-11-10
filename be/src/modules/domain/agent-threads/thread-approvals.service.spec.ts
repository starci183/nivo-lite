import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { DecisionLogReadService, WorkEngineService } from "@modules/domain/decisions"
import { GraphNodesError, GraphNodesErrorCode } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { ProviderAbilitiesService } from "@modules/domain/mcp-gateway"
import type { ProviderBoard } from "@modules/domain/mcp-gateway"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkItemsService } from "@modules/domain/work-items"
import type { WorkItem } from "@modules/domain/work-items"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
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
    leadId: "lead-1",
    turn: TURN,
    card: {
        locale: "vi",
        workflow: { moduleKey: "sales", key: "order", title: "Orders" },
        step: { key: "qr", nodeId: "sales.payment-qr", title: "Make QR" },
        by: "ai",
    },
}

/** The host's typed refusal of a call of `nivo.payment.qr.create` an `ask` tick holds. */
const askError = (params: Record<string, unknown> = {}): GraphNodesError =>
    new GraphNodesError({
        code: GraphNodesErrorCode.ToolApprovalRequired,
        params: { tool: "nivo.payment.qr.create", fingerprint: FINGERPRINT, reason: "ask_mode", ...params },
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
    leadId: "lead-1",
    conversationId: "conv-1",
    kind: "approval",
    state: "open",
    reason: "The AI needs your approval",
    question: null,
    detail: {
        suggestions: [],
        facts: factsOf(["tool", "nivo.payment.qr.create"], ["workItemId", "item-1"], ["fingerprint", FINGERPRINT]),
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
                    tools: ["nivo.payment.qr.create"],
                },
            ],
            accounts: [
                { connectionId: "conn-1", provider: "sepay", label: "MB Bank 5252", connected: true, isDefault: true },
            ],
        },
    ],
    attachments: [],
}

interface Options {
    readonly stop?: RunStop | null
    readonly existing?: WorkItem | null
    readonly latest?: WorkItem | null
    readonly raise?: "ok" | "throws"
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
    const engine = mock<WorkEngineService>({
        runWork: jest.fn(async () => {
            await Promise.resolve()
            if (options.raise === "throws") throw new RunStopsError({ code: RunStopsErrorCode.Contended })
            return itemOf({ id: "item-1" })
        }),
        resumeWork: jest.fn().mockResolvedValue(itemOf({ status: "rejected" })),
    })
    const items = mock<WorkItemsService>({
        findByDedupe: jest.fn().mockResolvedValue(options.existing ?? null),
        latestOfKey: jest.fn().mockResolvedValue(options.latest ?? null),
        findMany: jest
            .fn()
            .mockResolvedValue(options.existing === undefined || options.existing === null ? [] : [options.existing]),
    })
    const installations = mock<InstallationRecordsService>({
        ofAgent: jest.fn().mockResolvedValue({ moduleKey: "sales" }),
    })
    const abilities = mock<ProviderAbilitiesService>({
        judge: jest
            .fn()
            .mockResolvedValue({ kind: "approval", provider: "sepay", ability: "qr.create", connectionId: "conn-1" }),
        board: jest.fn().mockResolvedValue(BOARD),
    })
    const deciders = mock<DecisionLogReadService>({
        decidersOf: jest.fn().mockResolvedValue(new Map([["item-1", "member-owner"]])),
    })
    const runs = mock<ThreadResumer>({ resume: jest.fn().mockResolvedValue({ kind: "admitted", fresh: true }) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadApprovalsService,
            { provide: RunStopsService, useValue: stops },
            { provide: RunStopRecordsService, useValue: records },
            { provide: WorkEngineService, useValue: engine },
            { provide: WorkItemsService, useValue: items },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: ProviderAbilitiesService, useValue: abilities },
            { provide: DecisionLogReadService, useValue: deciders },
            { provide: CLOCK, useValue: new FakeClock(new Date(NOW)) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn((key: string) => `[${key}]`) }) },
        ],
    }).compile()
    const current = (): RunStop | null => stop
    return { service: moduleRef.get(ThreadApprovalsService), stops, engine, items, abilities, runs, current }
}

describe("ThreadApprovalsService.asked", () => {
    it("raises ONE owner item for the exact call, with no line of its own, and opens the approval stop that names tool, account and arguments", async () => {
        const { service, engine, stops } = await build()

        const asked = await service.asked(STEP, askError({ args: JSON.stringify({ orderId: "DH-1", amountVnd: "25000" }) }))

        expect(asked).toMatchObject({
            kind: "stopped",
            workItemId: "item-1",
            question: { kind: "approval", stepKey: "qr" },
        })
        expect(engine.runWork).toHaveBeenCalledTimes(1)
        const [ctx, spec] = engine.runWork.mock.calls[0] ?? []
        expect(ctx).toEqual({ workspaceId: "ws-1", actor: "NIVO", locale: "vi" })
        expect(spec).toMatchObject({
            action: "approve_tool_call",
            department: "sales",
            subject_type: "lead",
            subject_id: "lead-1",
            dedupeKey: KEY,
            preset: true,
            noChain: true,
            forceAsk: "branch_ask",
            ownCard: true,
            seed: {
                fields: {
                    engine: "langgraph",
                    runId: "run-1",
                    stepKey: "qr",
                    tool: "nivo.payment.qr.create",
                    fingerprint: FINGERPRINT,
                    account: "SePay · MB Bank 5252",
                    connectionId: "conn-1",
                    args: "orderId: DH-1\namountVnd: 25000",
                },
            },
        })
        const [opened] = stops.stopped.mock.calls[0] ?? []
        expect(opened).toMatchObject({
            kind: "approval",
            runId: "run-1",
            stepKey: "qr",
            conversationId: "conv-1",
            leadId: "lead-1",
        })
        expect(opened?.facts).toEqual([
            { name: "tool", value: "nivo.payment.qr.create" },
            { name: "account", value: "SePay · MB Bank 5252" },
            { name: "ability", value: "Create a payment QR (vi)" },
            { name: "orderId", value: "DH-1" },
            { name: "amountVnd", value: "25000" },
            { name: "workItemId", value: "item-1" },
            { name: "fingerprint", value: FINGERPRINT },
        ])
    })

    it("asks again on the item already waiting (a word or a retry on the card), never a second item", async () => {
        const { service, engine, stops } = await build({ existing: itemOf({ id: "item-1" }), stop: stopOf() })

        const asked = await service.asked(STEP, askError())

        expect(asked).toMatchObject({ kind: "stopped", workItemId: "item-1" })
        expect(engine.runWork).not.toHaveBeenCalled()
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
            expect(world.engine.runWork).not.toHaveBeenCalled()
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
    it("names the tool alone when no provider ability asked (a tool grant in ask mode) and renames an argument named like an engine fact", async () => {
        const { service, abilities, stops, engine } = await build()
        abilities.judge.mockResolvedValue(null)

        await service.asked({ ...STEP, leadId: null }, askError({ args: { tool: "x" } }))

        const [opened] = stops.stopped.mock.calls[0] ?? []
        expect(opened?.facts.map((fact) => fact.name)).toEqual(["tool", "arg.tool", "workItemId", "fingerprint"])
        expect(engine.runWork.mock.calls[0]?.[1]).toMatchObject({ subject_type: "conversation", subject_id: "conv-1" })
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
        expect(runs.resume).toHaveBeenCalledWith(REF, { kind: "retry", by: "member-owner", at: NOW })
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

        expect(person.runs.resume).toHaveBeenCalledWith(REF, {
            kind: "answer",
            text: "Not allowed",
            by: "member-2",
            at: NOW,
        })
        expect(person.current()?.detail.facts).toContainEqual({ name: "verdict", value: "refused" })
        expect(deadline.runs.resume).toHaveBeenCalledWith(REF, { kind: "timeout", at: NOW })
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
            latest: itemOf({ status: "done" }),
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
    it("closes the waiting item as refused by the engine (its performer then wakes the thread)", async () => {
        const { service, engine, runs } = await build({ stop: stopOf(), existing: itemOf() })

        expect(await service.expired(REF, "qr", runs)).toEqual({ kind: "admitted", fresh: true })
        expect(engine.resumeWork).toHaveBeenCalledWith(
            { workspaceId: "ws-1", actor: "NIVO", locale: "vi" },
            "item-1",
            "rejected",
            {},
            { name: "NIVO", kind: "staff" },
            null,
        )
        expect(runs.resume).not.toHaveBeenCalled()
    })

    it("wakes the thread with a timeout itself when the item no longer waits, and does nothing without an open approval stop", async () => {
        const failed = await build({ stop: stopOf(), existing: itemOf({ status: "failed" }) })
        const none = await build({ stop: stopOf({ kind: "ai_error" }) })

        expect(await failed.service.expired(REF, "qr", failed.runs)).toEqual({ kind: "admitted", fresh: true })
        expect(failed.runs.resume).toHaveBeenCalledWith(REF, { kind: "timeout", at: NOW })
        expect(failed.engine.resumeWork).not.toHaveBeenCalled()
        expect(await none.service.expired(REF, "qr", none.runs)).toBeNull()
    })

    it("leaves the thread to a person's decision that closed the item while the deadline ran", async () => {
        const { service, engine, runs } = await build({ stop: stopOf(), existing: itemOf() })
        engine.resumeWork.mockRejectedValue(new RunStopsError({ code: RunStopsErrorCode.NotFound }))

        expect(await service.expired(REF, "qr", runs)).toMatchObject({ kind: "refused", code: "decided_meanwhile" })
        expect(runs.resume).not.toHaveBeenCalled()
    })
})
