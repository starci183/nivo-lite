import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ApprovalRequestsReadService } from "@modules/domain/approval-requests"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ModuleCatalogService, WorkDrainService, WorkEngineService } from "@modules/domain/decisions"
import type { ActionEntry } from "@modules/domain/decisions"
import { LeadReadService } from "@modules/domain/leads"
import { ThreadApprovalsService, ThreadMessagesService } from "@modules/domain/thread-messages"
import { WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import { IsNull, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import {
    agentFoundOf,
    CARDED,
    DISCOUNT,
    LEAD,
    leadCardsOf,
    memberFoundOf,
    MESSAGE,
    MINH,
    SALES_AI,
    SALES_ROW,
    settledRequestsOf,
    settledRow,
    workRow,
} from "@tests/fixtures/builders/thread-work-service.builder"
import { ThreadWorkErrorCode } from "./errors/thread-work.error"
import { ThreadWorkEntity } from "./persistence/entities"
import { ThreadWorkLogEvent } from "./thread-work.log-events"
import { ThreadWorkService } from "./thread-work.service"
import { ThreadTagWakesService } from "./thread-tag-wakes.service"
import { ThreadWorkTurnsService } from "./thread-work-turns.service"
import type {
    DeciderRecord,
    SettledAskRecord,
    ThreadWorkRecord,
    ThreadWorkStart,
    WorkAgentRecord,
    WorkLeadRecord,
} from "./thread-work.contracts"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

interface Rows {
    readonly agents?: ReadonlyArray<WorkAgentRecord>
    readonly leads?: ReadonlyArray<WorkLeadRecord>
    readonly deciders?: ReadonlyArray<DeciderRecord>
    readonly waiting?: ReadonlyArray<ThreadWorkRecord>
    readonly settled?: ReadonlyArray<SettledAskRecord>
}

/** The stored piece of work a record stands for. */
const threadWorkEntityOf = (record: ThreadWorkRecord): ThreadWorkEntity =>
    Object.assign(new ThreadWorkEntity(), {
        id: record.id,
        workspaceId: record.workspace_id,
        threadId: record.thread_id,
        workItemId: record.work_item_id,
        agentId: record.agent_id,
        state: record.state,
        approvalRequestId: record.approval_request_id,
        waitingMemberId: record.waiting_member_id,
        missingFields: record.missing_fields,
    })

const rowsByManager = new WeakMap<object, Rows>()

/**
 * The manager double, overridable per spec: the waiting work and the asking work are found by entity; the agent, the customer, the
 * decider and how each request ended are answered by the owners' services, which `build` makes from the same rows.
 */
const managerOf = (rows: Rows = {}) => {
    const waiting = rows.waiting ?? [workRow()]
    const em = mockEntityManager({
        findOne: [ThreadWorkEntity, waiting[0] === undefined ? null : threadWorkEntityOf(waiting[0])],
        find: [ThreadWorkEntity, (rows.settled ?? [settledRow()]).map(threadWorkEntityOf)],
    })
    rowsByManager.set(em, rows)
    return { em }
}

const build = async (em: MockEntityManager, entry: ActionEntry | null = DISCOUNT) => {
    const rows = rowsByManager.get(em) ?? {}
    const logger = mock<Logger>()
    const agents = mock<AgentDirectoryService>()
    agents.findActive.mockResolvedValue(agentFoundOf((rows.agents ?? [SALES_ROW])[0]))
    const leads = mock<LeadReadService>()
    leads.cardsOf.mockResolvedValue(leadCardsOf((rows.leads ?? [LEAD])[0]))
    const members = mock<WorkspaceMemberDirectoryService>()
    members.find.mockResolvedValue(memberFoundOf((rows.deciders ?? [MINH])[0]))
    const requests = mock<ApprovalRequestsReadService>()
    requests.settledOf.mockResolvedValue(settledRequestsOf(rows.settled ?? [settledRow()]))
    const engine = mock<WorkEngineService>({
        resumeWork: jest.fn().mockResolvedValue(itemOf({ status: "done" })),
    })
    const modules = mock<ModuleCatalogService>({ actionOf: jest.fn().mockResolvedValue(entry) })
    const rules = mock<AuthorityRulesService>({ approvalSetup: jest.fn().mockResolvedValue({ unit: "percent" }) })
    const turns = mock<ThreadWorkTurnsService>({
        run: jest.fn().mockResolvedValue(undefined),
        react: jest.fn().mockResolvedValue(undefined),
        move: jest.fn().mockResolvedValue(undefined),
    })
    const messages = mock<ThreadMessagesService>({ postAsUser: jest.fn().mockResolvedValue(MESSAGE) })
    const approvals = mock<ThreadApprovalsService>({ decide: jest.fn().mockResolvedValue(MESSAGE) })
    const drain = mock<WorkDrainService>({ drainAll: jest.fn().mockResolvedValue(3) })
    const tagWakes = mock<ThreadTagWakesService>({ wake: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadWorkService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: logger },
            { provide: WorkEngineService, useValue: engine },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: ThreadWorkTurnsService, useValue: turns },
            { provide: ThreadMessagesService, useValue: messages },
            { provide: ThreadApprovalsService, useValue: approvals },
            { provide: WorkDrainService, useValue: drain },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: LeadReadService, useValue: leads },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
            { provide: ApprovalRequestsReadService, useValue: requests },
            { provide: ThreadTagWakesService, useValue: tagWakes },
        ],
    }).compile()
    return {
        service: moduleRef.get(ThreadWorkService),
        logger,
        engine,
        rules,
        turns,
        messages,
        approvals,
        agents,
        leads,
        members,
        requests,
        tagWakes,
    }
}

const START: ThreadWorkStart = {
    workspaceId: "ws-1",
    threadId: "thread-1",
    agentId: "agent-sales",
    actorName: "Lan",
    summary: "Giam 8% cho chi Thao",
    task: { action: "give_discount", amount: 8, amountVnd: 6_440_000, leadId: "lead-thao" },
}

const PLACE = { workspaceId: "ws-1", threadId: "thread-1", workId: "work-1", agent: SALES_AI, locale: "vi" }
const CTX = { workspaceId: "ws-1", actor: "NIVO", locale: "vi" }
const BY_MINH = { name: "Anh Minh", kind: "staff", memberId: "m-minh" }

const registerStart = () => {
    describe("start", () => {
        it("runs the agent's first step about the customer, with the amount in the unit of the action's rule", async () => {
            const { service, turns, agents, leads } = await build(managerOf().em)

            await service.start(START)

            expect(agents.findActive).toHaveBeenCalledWith("ws-1", "agent-sales")
            expect(leads.cardsOf).toHaveBeenCalledWith("ws-1", ["lead-thao"])

            expect(turns.run).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                threadId: "thread-1",
                agent: SALES_AI,
                action: "give_discount",
                leadId: "lead-thao",
                seed: {
                    summary: "Giam 8% cho chi Thao",
                    amount_vnd: 6_440_000,
                    fields: {
                        customer: "Chi Thao",
                        note: "Giam 8% cho chi Thao",
                        amount_vnd: 6_440_000,
                        amount_percent: 8,
                    },
                },
                parentId: null,
                actorName: "Lan",
            })
        })
    })
}

const registerStartCases = () => {
    describe("start cases", () => {
        it("counts in VND an action that has no rule yet", async () => {
            const { service, turns, rules } = await build(managerOf().em)
            rules.approvalSetup.mockResolvedValue(null)

            await service.start(START)

            expect(turns.run).toHaveBeenCalledWith(
                objectLike({
                    seed: objectLike({
                        amount_vnd: 8,
                        fields: objectLike({ amount_vnd: 8 }),
                    }),
                }),
            )
        })

        it.each([
            {
                name: "an agent that is not active",
                rows: { agents: [] },
                entry: DISCOUNT,
                code: ThreadWorkErrorCode.AgentNotFound,
            },
            {
                name: "an action outside the registry",
                rows: {},
                entry: null,
                code: ThreadWorkErrorCode.ActionNotOfAgent,
            },
            {
                name: "an action of another department",
                rows: {},
                entry: { ...DISCOUNT, moduleKey: "accounting" },
                code: ThreadWorkErrorCode.ActionNotOfAgent,
            },
            {
                name: "a customer outside the workspace",
                rows: { leads: [] },
                entry: DISCOUNT,
                code: ThreadWorkErrorCode.LeadNotFound,
            },
        ])("refuses $name and runs nothing", async ({ rows, entry, code }) => {
            const { service, turns } = await build(managerOf(rows).em, entry)

            await expect(service.start(START)).rejects.toMatchObject({ code })
            expect(turns.run).not.toHaveBeenCalled()
        })
    })
}

const registerDoors = () => {
    describe("post and decide", () => {
        it("writes the member's message, then lets the work that waited for their answer go on with it", async () => {
            const em = managerOf({ deciders: [{ id: "m-van", display_name: "Van", role: "staff" }] }).em
            const { service, messages, engine, turns } = await build(em)
            const post = {
                workspaceId: "ws-1",
                threadId: "thread-1",
                userId: "u-van",
                body: "0312345678",
                mentions: [],
                quoted: [],
                locale: "vi" as const,
            }

            await expect(service.post(post)).resolves.toBe(MESSAGE)

            expect(messages.postAsUser).toHaveBeenCalledWith(post)
            expect(engine.resumeWork).toHaveBeenCalledWith(
                CTX,
                "item-1",
                "approved",
                { fields: { tax_code: "0312345678" } },
                { name: "Van", kind: "staff", memberId: "m-van" },
            )
            expect(turns.react).toHaveBeenCalledWith(PLACE, itemOf({ status: "done" }))
        })

        it("wakes the agents the message tags unless it was the answer an agent waited for", async () => {
            const post = { workspaceId: "ws-1", threadId: "thread-1", userId: "u-van", body: "x", mentions: [], quoted: [], locale: "vi" as const }
            const waited = await build(managerOf({ deciders: [{ id: "m-van", display_name: "Van", role: "staff" }] }).em)
            const free = await build(managerOf({ waiting: [] }).em)

            await waited.service.post(post)
            await free.service.post(post)

            expect(waited.tagWakes.wake).not.toHaveBeenCalled()
            expect(free.tagWakes.wake).toHaveBeenCalledWith(post, MESSAGE)
        })

        it("decides the card, then moves the work of a settled request on; a message without a card moves nothing", async () => {
            const { service, approvals, engine } = await build(managerOf().em)
            const decision = {
                workspaceId: "ws-1",
                messageId: "msg-1",
                userId: "u-minh",
                verdict: "approve" as const,
                locale: "vi" as const,
            }
            approvals.decide.mockResolvedValueOnce(CARDED)

            await service.decide(decision)
            await service.decide(decision)

            expect(approvals.decide).toHaveBeenCalledWith(decision)
            expect(engine.resumeWork).toHaveBeenCalledTimes(1)
            expect(engine.resumeWork).toHaveBeenCalledWith(CTX, "item-1", "approved", {}, BY_MINH)
        })
    })
}

const registerReplies = () => {
    describe("memberReplied", () => {
        it.each([
            { name: "no work waits for the member", rows: { waiting: [] } },
            { name: "the member is gone", rows: { deciders: [] } },
        ])("answers false when $name", async ({ rows }) => {
            const { service, engine } = await build(managerOf(rows).em)

            await expect(
                service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" }),
            ).resolves.toBe(false)
            expect(engine.resumeWork).not.toHaveBeenCalled()
        })

        it("finds a waiting member's work oldest first, only in the state that waits for them", async () => {
            const harness = managerOf()
            const { service } = await build(harness.em)

            await service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" })

            expect(harness.em.findOne).toHaveBeenCalledWith(ThreadWorkEntity, {
                where: { workspaceId: "ws-1", threadId: "thread-1", waitingMemberId: "m-van", state: "waiting_member" },
                order: { updatedAt: "ASC" },
            })
        })

        it("keeps the work waiting and logs when the answer cannot move it on", async () => {
            const { service, engine, logger, turns } = await build(managerOf().em)
            const cause = new Error("still missing")
            engine.resumeWork.mockRejectedValue(cause)

            await expect(
                service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" }),
            ).resolves.toBe(true)
            expect(logger.error).toHaveBeenCalledWith(ThreadWorkLogEvent.ReplyFailed, cause, { workId: "work-1" })
            expect(turns.move).not.toHaveBeenCalled()
        })

        it("resumes but says nothing when the agent was paused meanwhile", async () => {
            const { service, engine, turns } = await build(managerOf({ agents: [] }).em)

            await service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" })

            expect(engine.resumeWork).toHaveBeenCalled()
            expect(turns.react).not.toHaveBeenCalled()
        })
    })
}

const stoppedMove = { state: "stopped", requestId: "req-1", memberId: null, missing: [] }

const registerTick = () => {
    describe("tick", () => {
        it("drains the queued steps, then moves on the settled approvals, and answers how many of each", async () => {
            const { service, engine } = await build(managerOf().em)

            await expect(service.tick()).resolves.toEqual({ steps: 3, settled: 1 })
            expect(engine.resumeWork).toHaveBeenCalledTimes(1)
        })
    })
}

const registerResumeSettled = () => {
    describe("resumeSettled", () => {
        it("resumes an approved request as the member who approved it, and the agent goes on", async () => {
            const harness = managerOf()
            const { service, engine, turns, requests } = await build(harness.em)

            await expect(service.resumeSettled()).resolves.toBe(1)

            expect(harness.em.find).toHaveBeenCalledWith(ThreadWorkEntity, {
                where: { state: "asked", approvalRequestId: Not(IsNull()) },
                order: { updatedAt: "ASC", id: "ASC" },
                take: 1000,
            })
            expect(requests.settledOf).toHaveBeenCalledWith(["req-1"])

            expect(engine.resumeWork).toHaveBeenCalledWith(CTX, "item-1", "approved", {}, BY_MINH)
            expect(turns.react).toHaveBeenCalled()
            expect(turns.move).not.toHaveBeenCalled()
        })

        it("stops the work of a refused request as the member who refused it", async () => {
            const { service, engine, turns } = await build(
                managerOf({ settled: [settledRow({ request_status: "rejected" })] }).em,
            )

            await service.resumeSettled()

            expect(engine.resumeWork).toHaveBeenCalledWith(CTX, "item-1", "rejected", {}, BY_MINH)
            expect(turns.move).toHaveBeenCalledWith({ workspaceId: "ws-1", workId: "work-1" }, stoppedMove)
        })

        it.each([
            { name: "an expired request", row: settledRow({ request_status: "expired", resolved_by: null }) },
            { name: "a request settled by nobody known", row: settledRow({ resolved_by: null }) },
        ])("leaves the work to the owner after $name", async ({ row }) => {
            const { service, engine, turns } = await build(managerOf({ settled: [row] }).em)

            await service.resumeSettled()

            expect(engine.resumeWork).not.toHaveBeenCalled()
            expect(turns.move).toHaveBeenCalledWith({ workspaceId: "ws-1", workId: "work-1" }, stoppedMove)
        })

        it("moves on the work of one request right after it is decided", async () => {
            const harness = managerOf()
            const { service, engine } = await build(harness.em)

            await service.approvalSettled("req-1")

            expect(harness.em.find).toHaveBeenCalledWith(ThreadWorkEntity, {
                where: { state: "asked", approvalRequestId: "req-1" },
                order: { updatedAt: "ASC", id: "ASC" },
                take: 1,
            })
            expect(engine.resumeWork).toHaveBeenCalledTimes(1)
        })
    })
}

const registerResumeScan = () => {
    describe("resumeSettled scan", () => {
        it("looks past the asking work that is still pending, in one bounded read, and skips work without a request", async () => {
            const pending = Array.from({ length: 100 }, (_, index) =>
                threadWorkEntityOf(settledRow({ id: `pending-${index}`, approval_request_id: `req-p${index}` })),
            )
            const noRequest = threadWorkEntityOf(settledRow({ id: "no-request", approval_request_id: null }))
            const harness = managerOf()
            harness.em.find.mockResolvedValueOnce([...pending, noRequest, threadWorkEntityOf(settledRow())])
            const { service, requests, engine } = await build(harness.em)
            requests.settledOf.mockResolvedValueOnce([{ id: "req-1", status: "approved", resolvedBy: "m-minh" }])

            await expect(service.resumeSettled()).resolves.toBe(1)

            expect(harness.em.find).toHaveBeenCalledTimes(1)
            expect(harness.em.find).toHaveBeenLastCalledWith(ThreadWorkEntity, expect.objectContaining({ take: 1000 }))
            expect(engine.resumeWork).toHaveBeenCalledTimes(1)
        })

        it("logs a request whose work cannot resume and stops it", async () => {
            const { service, engine, logger, turns } = await build(managerOf().em)
            const cause = new Error("not waiting")
            engine.resumeWork.mockRejectedValue(cause)

            await service.resumeSettled()

            expect(logger.error).toHaveBeenCalledWith(ThreadWorkLogEvent.ResumeFailed, cause, { workId: "work-1" })
            expect(turns.move).toHaveBeenCalledWith({ workspaceId: "ws-1", workId: "work-1" }, stoppedMove)
        })
    })
}

describe("ThreadWorkService", () => {
    registerStart()
    registerStartCases()
    registerDoors()
    registerReplies()
    registerTick()
    registerResumeSettled()
    registerResumeScan()
})
