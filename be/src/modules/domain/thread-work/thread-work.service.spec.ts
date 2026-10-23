import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ModuleCatalogService, WorkDrainService, WorkEngineService } from "@modules/domain/decisions"
import type { ActionEntry } from "@modules/domain/decisions"
import { ThreadApprovalsService, ThreadMessagesService } from "@modules/domain/thread-messages"
import type { ThreadMessage } from "@modules/domain/thread-messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import { ThreadWorkErrorCode } from "./errors/thread-work.error"
import type {
    DeciderRow,
    SettledAskRow,
    ThreadWorkRow,
    WorkAgentRow,
    WorkLeadRow,
} from "./persistence/thread-work.rows"
import {
    FIND_DECIDER,
    FIND_SETTLED_ASK,
    FIND_WAITING_FOR_MEMBER,
    FIND_WORK_AGENT,
    FIND_WORK_LEAD,
    LIST_SETTLED_ASKS,
} from "./persistence/thread-work.sql"
import { ThreadWorkLogEvent } from "./thread-work.log-events"
import { ThreadWorkService } from "./thread-work.service"
import { ThreadWorkTurnsService } from "./thread-work-turns.service"
import type { ThreadWorkStart } from "./thread-work.contracts"

const SALES_ROW: WorkAgentRow = {
    id: "agent-sales",
    name: "AI Sales",
    module: "sales",
    can_tag_agent_ids: ["agent-accounting"],
}
const SALES_AI = { id: "agent-sales", name: "AI Sales", module: "sales", canTag: ["agent-accounting"] }
const LEAD: WorkLeadRow = { id: "lead-thao", contact_name: "Chi Thao" }
const MINH: DeciderRow = { id: "m-minh", display_name: "Anh Minh", role: "manager" }

const DISCOUNT: ActionEntry = {
    action: "give_discount",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Giam gia", en: "Give discount" },
}

const workRow = (overrides: Partial<ThreadWorkRow> = {}): ThreadWorkRow => ({
    id: "work-1",
    workspace_id: "ws-1",
    thread_id: "thread-1",
    work_item_id: "item-1",
    agent_id: "agent-sales",
    state: "waiting_member",
    approval_request_id: null,
    waiting_member_id: "m-van",
    missing_fields: ["tax_code"],
    ...overrides,
})

const settledRow = (overrides: Partial<SettledAskRow> = {}): SettledAskRow => ({
    ...workRow({ state: "asked", approval_request_id: "req-1", waiting_member_id: null, missing_fields: [] }),
    request_status: "approved",
    resolved_by: "m-minh",
    ...overrides,
})

interface Rows {
    readonly agents?: ReadonlyArray<WorkAgentRow>
    readonly leads?: ReadonlyArray<WorkLeadRow>
    readonly deciders?: ReadonlyArray<DeciderRow>
    readonly waiting?: ReadonlyArray<ThreadWorkRow>
    readonly settled?: ReadonlyArray<SettledAskRow>
}

/** The rows the database double answers for each statement, overridable per spec. */
const stubsOf = (rows: Rows = {}) => ({
    query: [
        [FIND_WORK_AGENT, rows.agents ?? [SALES_ROW]],
        [FIND_WORK_LEAD, rows.leads ?? [LEAD]],
        [FIND_DECIDER, rows.deciders ?? [MINH]],
        [FIND_WAITING_FOR_MEMBER, rows.waiting ?? [workRow()]],
        [FIND_SETTLED_ASK, rows.settled ?? [settledRow()]],
        [LIST_SETTLED_ASKS, rows.settled ?? [settledRow()]],
    ] as const,
})

const MESSAGE: ThreadMessage = {
    id: "msg-1",
    threadId: "thread-1",
    authorKind: "member",
    authorId: "m-van",
    authorName: "Van",
    authorRole: "staff",
    body: "0312345678",
    quoted: [],
    mentions: [],
    approval: null,
    createdAt: "2026-10-22T09:44:00.000Z",
}

const CARDED: ThreadMessage = {
    ...MESSAGE,
    approval: {
        requestId: "req-1",
        action: "Giam gia 8%",
        amount: 8,
        unit: "percent",
        rule: "Giam gia",
        policy: "any",
        expiresAt: "2026-10-22T10:11:00.000Z",
        approvers: [],
        excluded: [],
        outcome: "approved",
        decidedBy: "m-minh",
        decidedByName: "Anh Minh",
        decidedAt: "2026-10-22T09:42:00.000Z",
        owner: null,
    },
}

const build = async (em: MockEntityManager, entry: ActionEntry | null = DISCOUNT) => {
    const logger = mock<Logger>()
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
        ],
    }).compile()
    return { service: moduleRef.get(ThreadWorkService), logger, engine, rules, turns, messages, approvals }
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
            const { service, turns } = await build(mockEntityManager(stubsOf()))

            await service.start(START)

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

        it("counts in VND an action that has no rule yet", async () => {
            const { service, turns, rules } = await build(mockEntityManager(stubsOf()))
            rules.approvalSetup.mockResolvedValue(null)

            await service.start(START)

            expect(turns.run).toHaveBeenCalledWith(
                expect.objectContaining({
                    seed: expect.objectContaining({
                        amount_vnd: 8,
                        fields: expect.objectContaining({ amount_vnd: 8 }),
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
            const { service, turns } = await build(mockEntityManager(stubsOf(rows)), entry)

            await expect(service.start(START)).rejects.toMatchObject({ code })
            expect(turns.run).not.toHaveBeenCalled()
        })
    })
}

const registerDoors = () => {
    describe("post and decide", () => {
        it("writes the member's message, then lets the work that waited for their answer go on with it", async () => {
            const em = mockEntityManager(stubsOf({ deciders: [{ id: "m-van", display_name: "Van", role: "staff" }] }))
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

        it("decides the card, then moves the work of a settled request on; a message without a card moves nothing", async () => {
            const { service, approvals, engine } = await build(mockEntityManager(stubsOf()))
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
            const { service, engine } = await build(mockEntityManager(stubsOf(rows)))

            await expect(
                service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" }),
            ).resolves.toBe(false)
            expect(engine.resumeWork).not.toHaveBeenCalled()
        })

        it("keeps the work waiting and logs when the answer cannot move it on", async () => {
            const { service, engine, logger, turns } = await build(mockEntityManager(stubsOf()))
            const cause = new Error("still missing")
            engine.resumeWork.mockRejectedValue(cause)

            await expect(
                service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" }),
            ).resolves.toBe(true)
            expect(logger.error).toHaveBeenCalledWith(ThreadWorkLogEvent.ReplyFailed, cause, { workId: "work-1" })
            expect(turns.move).not.toHaveBeenCalled()
        })

        it("resumes but says nothing when the agent was paused meanwhile", async () => {
            const { service, engine, turns } = await build(mockEntityManager(stubsOf({ agents: [] })))

            await service.memberReplied({ workspaceId: "ws-1", threadId: "thread-1", memberId: "m-van", body: "x" })

            expect(engine.resumeWork).toHaveBeenCalled()
            expect(turns.react).not.toHaveBeenCalled()
        })
    })
}

const stoppedMove = { state: "stopped", requestId: "req-1", memberId: null, missing: [] }

const registerSettled = () => {
    describe("tick", () => {
        it("drains the queued steps, then moves on the settled approvals, and answers how many of each", async () => {
            const { service, engine } = await build(mockEntityManager(stubsOf()))

            await expect(service.tick()).resolves.toEqual({ steps: 3, settled: 1 })
            expect(engine.resumeWork).toHaveBeenCalledTimes(1)
        })
    })

    describe("resumeSettled", () => {
        it("resumes an approved request as the member who approved it, and the agent goes on", async () => {
            const { service, engine, turns } = await build(mockEntityManager(stubsOf()))

            await expect(service.resumeSettled()).resolves.toBe(1)

            expect(engine.resumeWork).toHaveBeenCalledWith(CTX, "item-1", "approved", {}, BY_MINH)
            expect(turns.react).toHaveBeenCalled()
            expect(turns.move).not.toHaveBeenCalled()
        })

        it("stops the work of a refused request as the member who refused it", async () => {
            const { service, engine, turns } = await build(
                mockEntityManager(stubsOf({ settled: [settledRow({ request_status: "rejected" })] })),
            )

            await service.resumeSettled()

            expect(engine.resumeWork).toHaveBeenCalledWith(CTX, "item-1", "rejected", {}, BY_MINH)
            expect(turns.move).toHaveBeenCalledWith({ workspaceId: "ws-1", workId: "work-1" }, stoppedMove)
        })

        it.each([
            { name: "an expired request", row: settledRow({ request_status: "expired", resolved_by: null }) },
            { name: "a request settled by nobody known", row: settledRow({ resolved_by: null }) },
        ])("leaves the work to the owner after $name", async ({ row }) => {
            const { service, engine, turns } = await build(mockEntityManager(stubsOf({ settled: [row] })))

            await service.resumeSettled()

            expect(engine.resumeWork).not.toHaveBeenCalled()
            expect(turns.move).toHaveBeenCalledWith({ workspaceId: "ws-1", workId: "work-1" }, stoppedMove)
        })

        it("logs a request whose work cannot resume and stops it", async () => {
            const { service, engine, logger, turns } = await build(mockEntityManager(stubsOf()))
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
    registerDoors()
    registerReplies()
    registerSettled()
})
