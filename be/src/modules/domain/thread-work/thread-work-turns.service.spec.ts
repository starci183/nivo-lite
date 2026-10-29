import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentDirectoryService, AgentOwnershipService } from "@modules/domain/agents"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { ModuleCatalogService, WorkEngineService } from "@modules/domain/decisions"
import { ThreadAgentPostsService } from "@modules/domain/thread-messages"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { itemOf } from "@tests/fixtures/builders/work-decision.builder"
import {
    ACCOUNTING_ROW,
    COMMANDS,
    DISCOUNT,
    ENTRIES,
    PLACE,
    SETUP,
    STEP,
    rowOf,
    unrelated,
} from "@tests/fixtures/builders/thread-work-turns.builder"
import type { Doubles } from "@tests/fixtures/builders/thread-work-turns.builder"
import { ThreadWorkEntity } from "./persistence/entities"
import { ThreadWorkTurnsService } from "./thread-work-turns.service"

/** The arguments of the entity update that persists a transition, as the thread scenarios expect them. */
export const moved = (
    state: string,
    requestId: string | null = null,
    memberId: string | null = null,
    missing: Array<string> = [],
) =>
    [
        ThreadWorkEntity,
        { workspaceId: "ws-1", id: "work-1" },
        {
            state,
            ...(requestId === null ? {} : { approvalRequestId: requestId }),
            waitingMemberId: memberId,
            missingFields: missing,
            updatedAt: anyFunction(),
        },
    ] as const

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** The any-function matcher, typed `unknown` so it flows into any slot. */
const anyFunction = (): unknown => expect.any(Function)

/** What the `updatedAt` expression of a column change evaluates to. */
const nowOf = (change: unknown): unknown =>
    typeof change === "object" && change !== null && "updatedAt" in change && typeof change.updatedAt === "function"
        ? change.updatedAt()
        : undefined

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

/** Builds thread turns with explicit kit doubles for every constructor dependency. */
const build = async (doubles: Doubles = {}) => {
    const em: MockEntityManager = mockEntityManager({
        update: [ThreadWorkEntity, { affected: 1, raw: [], generatedMaps: [] }],
    })
    const write = fakeQueryBuilder({ execute: { raw: doubles.inserted ?? [rowOf("running")] } })
    em.createQueryBuilder.mockReturnValue(write.builder as never)
    const agents = mock<AgentDirectoryService>({
        activeInOrder: jest.fn().mockResolvedValue([
            {
                id: ACCOUNTING_ROW.id,
                name: ACCOUNTING_ROW.name,
                module: ACCOUNTING_ROW.module,
                canTagAgentIds: ACCOUNTING_ROW.can_tag_agent_ids,
            },
        ]),
    })
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
        acceptsOf: jest.fn().mockResolvedValue(doubles.commands ?? COMMANDS),
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
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { service: moduleRef.get(ThreadWorkTurnsService), em, write, engine, posts, catalog, modules, agents }
}

const registerRun = () => {
    describe("run", () => {
        it("runs the step through the work engine about the customer and records the work of the thread", async () => {
            const { service, em, engine, write, posts } = await build()

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
            expect(em.createQueryBuilder).toHaveBeenCalledWith(ThreadWorkEntity, "t")
            expect(write.callsOf("insert")).toEqual([[]])
            expect(write.callsOf("values")).toEqual([
                [{ workspaceId: "ws-1", threadId: "thread-1", workItemId: "item-1", agentId: "agent-sales" }],
            ])
            expect(write.callsOf("orUpdate")).toEqual([[["updated_at"], ["work_item_id"]]])
            expect(write.callsOf("returning")).toEqual([
                [
                    "id, workspace_id, thread_id, work_item_id, agent_id, state, approval_request_id, waiting_member_id, missing_fields",
                ],
            ])
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
            expect(em.update).toHaveBeenCalledWith(...moved("asked", "req-1"))
        })

        it("titles a card with no amount by the action alone", async () => {
            const { service, posts } = await build()

            await expect(
                service.react(PLACE, { ...DISCOUNT, proposal: { summary: "Giam gia", fields: {} } }),
            ).resolves.toBe("asked")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                objectLike({ approval: objectLike({ title: "Giam gia", amount: null }) }),
            )
        })

        it("stops when the ask carried no card back", async () => {
            const { service, em } = await build({ requestId: null })

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("stopped")

            expect(em.update).toHaveBeenCalledWith(...moved("stopped"))
        })

        it("stops when the chain limits stopped the ask or no request was opened", async () => {
            const { service, em } = await build({ stopped: "limit" })

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("stopped")

            expect(em.update).toHaveBeenCalledWith(...moved("stopped", "req-1"))
        })

        it.each([
            { name: "there is no rule", setup: null },
            { name: "the rule names nobody to ask", setup: { ...SETUP, group: { roles: [], rooms: [], members: [] } } },
        ])("goes to the owner when $name", async ({ setup }) => {
            const { service, posts, em } = await build({ setup })

            await expect(service.react(PLACE, DISCOUNT)).resolves.toBe("stopped")

            expect(posts.postAsAgent).toHaveBeenCalledWith(
                objectLike({ mentions: [{ kind: "member", id: "m-minh" }], approval: null }),
            )
            expect(em.update).toHaveBeenCalledWith(...moved("stopped"))
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
                objectLike({
                    body: 'threadWork.missing|{"action":"Xuat hoa don","fields":"MST, po"}',
                    mentions: [{ kind: "member", id: "m-van" }],
                    stepTitle: 'threadWork.missingStep|{"fields":"MST, po"}',
                }),
            )
            expect(em.update).toHaveBeenCalledWith(...moved("waiting_member", null, "m-van", ["tax_code", "po"]))
        })

        it("missing data with nobody named: asks the owner of the agent; a stopped chain waits for nobody", async () => {
            const { service, posts, em } = await build({ setup: null, stopped: "loop" })

            await expect(
                service.react(
                    PLACE,
                    itemOf({ action: "unknown_action", reason: "missing_data", missing_fields: ["x"] }),
                ),
            ).resolves.toBe("stopped")

            expect(posts.postAsAgent).toHaveBeenCalledWith(objectLike({ mentions: [{ kind: "member", id: "m-minh" }] }))
            expect(em.update).toHaveBeenCalledWith(...moved("stopped"))
        })
    })
}

const registerDone = () => {
    describe("react: the step is done", () => {
        it("hands the next action to the agent it may tag that performs it, then that agent runs it", async () => {
            const { service, posts, engine, em, agents } = await build()
            const done = itemOf({
                id: "item-1",
                action: "give_discount",
                status: "done",
                result: { summary: "Da giam 8%." },
                proposal: { summary: "Giam 8%", amount_vnd: 6_440_000, fields: { customer: "Chi Thao" } },
            })

            await expect(service.react(PLACE, done)).resolves.toBe("done")

            expect(agents.activeInOrder).toHaveBeenCalledWith("ws-1", ["agent-accounting"], 50)
            expect(posts.postAsAgent).toHaveBeenCalledWith(
                objectLike({
                    body: `threadWork.handoff|${JSON.stringify({ receiver: ACCOUNTING_ROW.name, next: COMMANDS[0]?.description.vi })}`,
                    mentions: [{ kind: "agent", id: "agent-accounting" }],
                    stepTitle: 'threadWork.handoffStep|{"next":"Xuat hoa don"}',
                }),
            )
            expect(em.update).toHaveBeenCalledWith(...moved("done"))
            expect(nowOf(em.update.mock.calls[0]?.[2])).toBe("now()")
            expect(engine.runWork).toHaveBeenCalledWith(
                { workspaceId: "ws-1", actor: "AI Sales", locale: "vi" },
                objectLike({
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
                anything(),
                objectLike({
                    seed: objectLike({
                        summary: 'threadWork.nextSummary|{"next":"Xuat hoa don","customer":""}',
                        amount_vnd: null,
                    }),
                }),
            )
        })
    })
}

const registerHandoffCopy = () => {
    describe("ThreadWorkTurnsService hand-off copy", () => {
        it.each(["vi", "en"] as const)("names the receiver and uses the catalog reason in %s", async (locale) => {
            const { service, posts, catalog, modules } = await build({ commands: [unrelated, ...COMMANDS] })
            const description = COMMANDS.find((command) => command.action === "issue_invoice")?.description[locale]
            expect(description).toBeDefined()

            await service.react(
                { ...PLACE, locale },
                itemOf({ action: "give_discount", status: "done", result: { summary: "engine.recordOnly" } }),
            )

            const params = { receiver: ACCOUNTING_ROW.name, next: description }
            expect(modules.acceptsOf).toHaveBeenCalledWith("accounting")
            expect(catalog.get).toHaveBeenCalledWith("threadWork.handoff", params, locale)
            expect(catalog.get).toHaveBeenCalledWith(
                "threadWork.handoffStep",
                { next: locale === "en" ? "Issue invoice" : "Xuat hoa don" },
                locale,
            )
            expect(posts.postAsAgent).toHaveBeenCalledWith(
                objectLike({
                    body: `threadWork.handoff|${JSON.stringify(params)}`,
                    mentions: [{ kind: "agent", id: ACCOUNTING_ROW.id }],
                    locale,
                }),
            )
        })

        it.each([
            { label: "absent", commands: [] },
            {
                label: "blank",
                commands: [{ ...unrelated, action: "issue_invoice", description: { vi: " ", en: " " } }],
            },
        ])("uses a localized action when the catalog reason is $label", async ({ commands }) => {
            const { service, posts, catalog } = await build({ commands })

            await service.react({ ...PLACE, locale: "en" }, itemOf({ action: "give_discount", status: "done" }))

            expect(catalog.get).toHaveBeenCalledWith("threadWork.handoffFallback", { action: "Issue invoice" }, "en")
            const params = {
                receiver: ACCOUNTING_ROW.name,
                next: 'threadWork.handoffFallback|{"action":"Issue invoice"}',
            }
            expect(posts.postAsAgent).toHaveBeenCalledWith(
                objectLike({ body: `threadWork.handoff|${JSON.stringify(params)}` }),
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

            expect(em.update).toHaveBeenCalledWith(...moved(state))
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
                objectLike({
                    body: "Xac nhan",
                    mentions: [],
                    stepTitle: 'threadWork.doneStep|{"action":"Xuat hoa don"}',
                }),
            )
            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                2,
                objectLike({
                    body: "Tom tat",
                    stepTitle: 'threadWork.doneStep|{"action":"unknown_action"}',
                }),
            )
            expect(em.update).toHaveBeenCalledWith(...moved("done"))
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
                objectLike({
                    body: 'threadWork.stopped|{"action":"Giam gia","reason":"boom"}',
                    mentions: [{ kind: "member", id: "m-minh" }],
                }),
            )
            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                2,
                objectLike({ body: 'threadWork.stopped|{"action":"Giam gia","reason":"Tu choi"}' }),
            )
            expect(posts.postAsAgent).toHaveBeenNthCalledWith(
                3,
                objectLike({ body: 'threadWork.stopped|{"action":"Giam gia","reason":""}' }),
            )
            expect(em.update).toHaveBeenCalledWith(...moved("stopped"))
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
    registerHandoffCopy()
    registerHandOffEnds()
    registerStop()
})
