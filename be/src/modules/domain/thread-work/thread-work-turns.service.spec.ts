import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentOwnershipService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { ModuleCatalogService, WorkEngineService } from "@modules/domain/decisions"
import type { ActionEntry, WorkItem } from "@modules/domain/decisions"
import { ThreadAgentPostsService } from "@modules/domain/thread-messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import type { ThreadWorkRow, WorkAgentRow } from "./persistence/thread-work.rows"
import { INSERT_THREAD_WORK, LIST_WORK_AGENTS, UPDATE_THREAD_WORK } from "./persistence/thread-work.sql"
import { ThreadWorkTurnsService } from "./thread-work-turns.service"
import type { AgentStep, WorkAgent, WorkPlace } from "./thread-work.contracts"

const SALES_AI: WorkAgent = { id: "agent-sales", name: "AI Sales", module: "sales", canTag: ["agent-accounting"] }
const ACCOUNTING_ROW: WorkAgentRow = {
    id: "agent-accounting",
    name: "Ke toan AI",
    module: "accounting",
    can_tag_agent_ids: [],
}

const PLACE: WorkPlace = { workspaceId: "ws-1", threadId: "thread-1", workId: "work-1", agent: SALES_AI, locale: "vi" }

const ENTRIES: Readonly<Record<string, ActionEntry>> = {
    give_discount: {
        action: "give_discount",
        moduleKey: "sales",
        maxMode: null,
        next: ["issue_invoice", "gone_action"],
        label: { vi: "Giam gia", en: "Give discount" },
    },
    issue_invoice: {
        action: "issue_invoice",
        moduleKey: "accounting",
        maxMode: null,
        next: [],
        label: { vi: "Xuat hoa don", en: "Issue invoice" },
    },
}

const SETUP: ApprovalSetup = {
    department: "sales",
    action: "give_discount",
    mode: "auto",
    unit: "percent",
    auto_max: 3,
    ask_max: 15,
    group: { roles: ["manager"], rooms: ["sales"], members: [] },
    policy: "any",
    timeout_minutes: 30,
    agents: [],
}

const rowOf = (state: ThreadWorkRow["state"]): ThreadWorkRow => ({
    id: "work-1",
    workspace_id: "ws-1",
    thread_id: "thread-1",
    work_item_id: "item-1",
    agent_id: "agent-sales",
    state,
    approval_request_id: null,
    waiting_member_id: null,
    missing_fields: [],
})

const DISCOUNT: WorkItem = itemOf({
    action: "give_discount",
    status: "waiting_decision",
    reason: "over_authority",
    proposal: {
        summary: "Giam 8% cho chi Thao",
        amount_vnd: 6_440_000,
        fields: { customer: "Chi Thao", amount_percent: 8 },
    },
})

interface Doubles {
    readonly inserted?: ReadonlyArray<ThreadWorkRow>
    readonly setup?: ApprovalSetup | null
    readonly stopped?: "limit" | "loop" | null
    readonly requestId?: string | null
}

/** The rows the database double answers for each statement. */
const stubsOf = (inserted: ReadonlyArray<ThreadWorkRow>) => ({
    query: [
        [INSERT_THREAD_WORK, inserted],
        [LIST_WORK_AGENTS, [ACCOUNTING_ROW]],
        [UPDATE_THREAD_WORK, []],
    ] as const,
})

const build = async (doubles: Doubles = {}) => {
    const em: MockEntityManager = mockEntityManager(stubsOf(doubles.inserted ?? [rowOf("running")]))
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) => {
            if (key === "engine.field.tax_code") return "MST"
            return key.startsWith("engine.field.") ? key : `${key}|${JSON.stringify(params)}`
        }),
    })
    const engine = mock<WorkEngineService>({ runWork: jest.fn().mockResolvedValue(itemOf({ status: "queued" })) })
    const requestId = doubles.requestId === undefined ? "req-1" : doubles.requestId
    const posts = mock<ThreadAgentPostsService>({
        postAsAgent: jest.fn().mockResolvedValue({
            message: { approval: requestId === null ? null : { requestId } },
            stopped: doubles.stopped ?? null,
        }),
    })
    const modules = mock<ModuleCatalogService>({
        actionOf: jest.fn((action: string) => Promise.resolve(ENTRIES[action] ?? null)),
    })
    const rules = mock<AuthorityRulesService>({
        approvalSetup: jest.fn().mockResolvedValue(doubles.setup === undefined ? SETUP : doubles.setup),
    })
    const ownership = mock<AgentOwnershipService>({
        ownerOf: jest.fn().mockResolvedValue({ ownerMemberId: "m-minh", fallbackMemberId: "m-nam" }),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ThreadWorkTurnsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkEngineService, useValue: engine },
            { provide: ThreadAgentPostsService, useValue: posts },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: AgentOwnershipService, useValue: ownership },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadWorkTurnsService), em, engine, posts }
}

const STEP: AgentStep = {
    workspaceId: "ws-1",
    threadId: "thread-1",
    agent: SALES_AI,
    action: "give_discount",
    leadId: "lead-thao",
    seed: { summary: "Giam 8%", amount_vnd: 6_440_000, fields: { customer: "Chi Thao", amount_percent: 8 } },
    parentId: null,
    actorName: "Lan",
}

const moved = (
    state: string,
    requestId: string | null = null,
    memberId: string | null = null,
    missing: Array<string> = [],
) => ["ws-1", "work-1", state, requestId, memberId, missing]

const registerRun = () => {
    describe("run", () => {
        it("runs the step through the work engine about the customer and records the work of the thread", async () => {
            const { service, engine, em, posts } = await build()

            await expect(service.run(STEP)).resolves.toBeNull()

            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "Lan", locale: "vi" },
                {
                    action: "give_discount",
                    subject_type: "lead",
                    subject_id: "lead-thao",
                    lead_id: "lead-thao",
                    parent_id: null,
                    dedupeKey: "thread:thread-1:agent-sales:give_discount",
                    seed: STEP.seed,
                },
            )
            expect(em.query).toHaveBeenCalledWith(INSERT_THREAD_WORK, ["ws-1", "thread-1", "item-1", "agent-sales"])
            expect(posts.postAsAgent).not.toHaveBeenCalled()
        })

        it("says nothing again for a step it already ran", async () => {
            const { service, engine, posts } = await build({ inserted: [rowOf("asked")] })
            engine.runWork.mockResolvedValue(DISCOUNT)

            await expect(service.run(STEP)).resolves.toBeNull()

            expect(posts.postAsAgent).not.toHaveBeenCalled()
        })
    })
}

const registerAsk = () => {
    describe("react: the gate asks", () => {
        it("over authority: tags the rule's room, carries the approval card and waits for the request", async () => {
            const { service, posts, em } = await build()

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("asked")

            expect(posts.postAsAgent).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                threadId: "thread-1",
                agentId: "agent-sales",
                body: 'threadWork.ask|{"action":"Giam gia","summary":"Giam 8% cho chi Thao"}',
                mentions: [{ kind: "group", id: "room:sales" }],
                quoted: [],
                stepTitle: 'threadWork.askStep|{"action":"Giam gia"}',
                approval: {
                    actionKey: "give_discount",
                    title: "Giam gia 8%",
                    amount: 8,
                    unit: "percent",
                    rule: "Giam gia",
                },
                locale: "vi",
            })
            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("asked", "req-1"))
        })

        it("titles a card with no amount by the action alone", async () => {
            const { service, posts } = await build()

            await expect(
                service.react(PLACE, { ...DISCOUNT, proposal: { summary: "Giam gia", fields: {} } }),
            ).resolves.toBe("asked")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                expect.objectContaining({ approval: expect.objectContaining({ title: "Giam gia", amount: null }) }),
            )
        })

        it("stops when the ask carried no card back", async () => {
            const { service, em } = await build({ requestId: null })

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("stopped")

            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("stopped"))
        })

        it("stops when the chain limits stopped the ask or no request was opened", async () => {
            const { service, em } = await build({ stopped: "limit" })

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("stopped")

            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("stopped", "req-1"))
        })

        it.each([
            { name: "there is no rule", setup: null },
            { name: "the rule names nobody to ask", setup: { ...SETUP, group: { roles: [], rooms: [], members: [] } } },
        ])("goes to the owner when $name", async ({ setup }) => {
            const { service, posts, em } = await build({ setup })

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("stopped")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                expect.objectContaining({ mentions: [{ kind: "member", id: "m-minh" }], approval: null }),
            )
            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("stopped"))
        })
    })
}

const registerMemberAsk = () => {
    describe("react: the gate asks for data", () => {
        it("missing data: tags the member the rule names and waits for their answer", async () => {
            const setup = { ...SETUP, action: "issue_invoice", group: { roles: [], rooms: [], members: ["m-van"] } }
            const { service, posts, em } = await build({ setup })
            const invoice = itemOf({
                action: "issue_invoice",
                reason: "missing_data",
                missing_fields: ["tax_code", "po"],
            })

            await expect(service.react(PLACE, invoice)).resolves.toBe("waiting_member")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: 'threadWork.missing|{"action":"Xuat hoa don","fields":"MST, po"}',
                    mentions: [{ kind: "member", id: "m-van" }],
                    stepTitle: 'threadWork.missingStep|{"fields":"MST, po"}',
                }),
            )
            expect(em.query).toHaveBeenCalledWith(
                UPDATE_THREAD_WORK,
                moved("waiting_member", null, "m-van", ["tax_code", "po"]),
            )
        })

        it("missing data with nobody named: asks the owner of the agent; a stopped chain waits for nobody", async () => {
            const { service, posts, em } = await build({ setup: null, stopped: "loop" })

            await expect(
                service.react(
                    PLACE,
                    itemOf({ action: "unknown_action", reason: "missing_data", missing_fields: ["x"] }),
                ),
            ).resolves.toBe("stopped")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                expect.objectContaining({ mentions: [{ kind: "member", id: "m-minh" }] }),
            )
            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("stopped"))
        })
    })
}

const registerDone = () => {
    describe("react: the step is done", () => {
        it("hands the next action to the agent it may tag that performs it, then that agent runs it", async () => {
            const { service, posts, engine, em } = await build()
            const done = itemOf({
                id: "item-1",
                action: "give_discount",
                status: "done",
                result: { summary: "Da giam 8%." },
                proposal: { summary: "Giam 8%", amount_vnd: 6_440_000, fields: { customer: "Chi Thao" } },
            })

            await expect(service.react(PLACE, done)).resolves.toBe("done")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                expect.objectContaining({
                    body: 'threadWork.handoff|{"done":"Da giam 8%.","next":"Xuat hoa don"}',
                    mentions: [{ kind: "agent", id: "agent-accounting" }],
                    stepTitle: 'threadWork.handoffStep|{"next":"Xuat hoa don"}',
                }),
            )
            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("done"))
            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "AI Sales", locale: "vi" },
                expect.objectContaining({
                    action: "issue_invoice",
                    lead_id: "lead-1",
                    parent_id: "item-1",
                    seed: {
                        summary: 'threadWork.nextSummary|{"next":"Xuat hoa don","customer":"Chi Thao"}',
                        draft: 'threadWork.confirmation|{"customer":"Chi Thao","done":"Da giam 8%."}',
                        amount_vnd: 6_440_000,
                        fields: { customer: "Chi Thao" },
                    },
                }),
            )
        })

        it("hands on a step that knows no customer name and no money with empty values", async () => {
            const { service, engine } = await build()

            await expect(
                service.react(
                    PLACE,
                    itemOf({ action: "give_discount", status: "done", proposal: { summary: "S", fields: {} } }),
                ),
            ).resolves.toBe("done")

            expect(engine.runWork).toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    seed: expect.objectContaining({
                        summary: 'threadWork.nextSummary|{"next":"Xuat hoa don","customer":""}',
                        amount_vnd: null,
                    }),
                }),
            )
        })
    })
}

const registerHandOffEnds = () => {
    describe("react: a done step that hands nothing on", () => {
        it.each([
            {
                name: "the chain limits stopped the hand-off",
                stopped: "loop" as const,
                leadId: "lead-1",
                state: "stopped",
            },
            { name: "the step is about no customer", stopped: null, leadId: null, state: "done" },
        ])("runs nothing more when $name", async ({ stopped, leadId, state }) => {
            const { service, engine, em } = await build({ stopped })

            await expect(
                service.react(PLACE, itemOf({ action: "give_discount", status: "done", lead_id: leadId })),
            ).resolves.toBe(state)

            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved(state))
            expect(engine.runWork).not.toHaveBeenCalled()
        })

        it("closes the work with its draft (or its result) when nothing follows, as a step of its own", async () => {
            const { service, posts, em } = await build()

            await expect(
                service.react(
                    PLACE,
                    itemOf({
                        action: "issue_invoice",
                        status: "done",
                        proposal: { summary: "S", draft: "Xac nhan", fields: {} },
                    }),
                ),
            ).resolves.toBe("done")
            await expect(
                service.react(
                    PLACE,
                    itemOf({
                        action: "unknown_action",
                        status: "done",
                        result: null,
                        proposal: { summary: "Tom tat", fields: {} },
                    }),
                ),
            ).resolves.toBe("done")

            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    body: "Xac nhan",
                    mentions: [],
                    stepTitle: 'threadWork.doneStep|{"action":"Xuat hoa don"}',
                }),
            )
            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    body: "Tom tat",
                    stepTitle: 'threadWork.doneStep|{"action":"unknown_action"}',
                }),
            )
            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("done"))
        })
    })
}

const registerStop = () => {
    describe("react: the step failed or was refused", () => {
        it("tags the owner of the agent with why, and stops", async () => {
            const { service, posts, em } = await build()

            await expect(
                service.react(PLACE, itemOf({ action: "give_discount", status: "failed", error: "boom" })),
            ).resolves.toBe("stopped")
            await expect(
                service.react(
                    PLACE,
                    itemOf({ action: "give_discount", status: "rejected", result: { summary: "Tu choi" } }),
                ),
            ).resolves.toBe("stopped")
            await expect(service.react(PLACE, itemOf({ action: "give_discount", status: "rejected" }))).resolves.toBe(
                "stopped",
            )

            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    body: 'threadWork.stopped|{"action":"Giam gia","reason":"boom"}',
                    mentions: [{ kind: "member", id: "m-minh" }],
                }),
            )
            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({ body: 'threadWork.stopped|{"action":"Giam gia","reason":"Tu choi"}' }),
            )
            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                3,
                expect.objectContaining({ body: 'threadWork.stopped|{"action":"Giam gia","reason":""}' }),
            )
            expect(em.query).toHaveBeenCalledWith(UPDATE_THREAD_WORK, moved("stopped"))
        })

        it("says nothing about a step still queued", async () => {
            const { service, posts } = await build()

            await expect(service.react(PLACE, itemOf({ status: "queued" }))).resolves.toBeNull()

            expect(posts.postAsAgent).not.toHaveBeenCalled()
        })
    })
}

describe("ThreadWorkTurnsService", () => {
    registerRun()
    registerAsk()
    registerMemberAsk()
    registerDone()
    registerHandOffEnds()
    registerStop()
})
