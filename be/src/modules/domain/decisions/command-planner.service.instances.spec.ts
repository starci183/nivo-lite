import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CommandPlannerService } from "./command-planner.service"
import type { ModuleEntry, SendCommandInput, WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { OfficeLinesService } from "@modules/domain/messages"
import {
    FIND_GIVEN_INSTALLATION,
    FIND_SENDER_AGENT,
    FIND_SUBJECT_LABEL,
    RESOLVE_INSTALLATION,
} from "./persistence/command-bus.sql"
import type { CommandPlan, PlannedCommand } from "./work-engine.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
const AGENT_ID = "2f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
const CONVERSATION_ID = "3f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"

const moduleOf = builder<ModuleEntry>({
    key: "sales",
    audience: "internal",
    multiInstance: false,
    name: { vi: "Ban hang", en: "Sales" },
    accepts: [
        {
            command: "classify_lead",
            action: "classify_lead",
            subjectType: "lead",
            requiredFields: ["lead_id"],
            description: { vi: "phan loai", en: "classify" },
        },
    ],
})

const chatbot = moduleOf({
    key: "chatbot",
    multiInstance: true,
    name: { vi: "Chatbot", en: "Chatbot" },
    accepts: [
        {
            command: "reply_customer",
            action: "reply_customer",
            subjectType: "conversation",
            requiredFields: [],
            description: { vi: "tra loi", en: "reply" },
        },
    ],
})

const MODULES: Readonly<Record<string, ModuleEntry>> = { sales: moduleOf(), chatbot }

const TEXTS: Readonly<Record<string, string>> = {
    "command.sender.owner": "Owner",
    "command.sender.inbound": "Customer",
    "command.mirror": "@{{to}} <- {{from}}: {{what}}",
    "command.mirror.subject": "@{{to}} <- {{from}}: {{what}} for {{subject}}",
    "command.subject.order": "order",
    "command.subject.lead": "customer",
}

const inputOf = builder<SendCommandInput>({
    from: "owner",
    to: "sales",
    command: "classify_lead",
    payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" },
    reason: "handoff",
})

const replyOf = builder<SendCommandInput>({
    from: "owner",
    to: "chatbot",
    command: "reply_customer",
    payload: { subject_type: "conversation", subject_id: CONVERSATION_ID },
    reason: "handoff",
})

const rowOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "classify_lead",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T10:00:00.000Z",
    updated_at: "2026-10-12T10:00:00.000Z",
    completed_at: null,
    installation_id: null,
})

type QueryStubs = ReadonlyArray<readonly [string, unknown]>

const build = async (queries: QueryStubs = []) => {
    const em = queries.length === 0 ? mockEntityManager() : mockEntityManager({ query: queries })
    const log = jest.fn().mockResolvedValue(undefined)
    const post = jest.fn().mockResolvedValue(undefined)
    const error = jest.fn()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CommandPlannerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: mock<Logger>({ error }) },
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({
                    get: jest.fn((key: string, params: Readonly<Record<string, string | number>>) =>
                        Object.entries(params).reduce(
                            (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
                            TEXTS[key] ?? key,
                        ),
                    ),
                }),
            },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({
                    entryOf: jest.fn((key: string) => Promise.resolve(MODULES[key] ?? null)),
                    nameOf: jest.fn((key: string) => Promise.resolve(MODULES[key]?.name.en ?? key)),
                }),
            },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ log }) },
            { provide: OfficeLinesService, useValue: mock<OfficeLinesService>({ post }) },
        ],
    }).compile()
    return { service: moduleRef.get(CommandPlannerService), em, log, post, error }
}

const planned = (plan: CommandPlan): PlannedCommand => {
    if (!plan.ok)
        throw new DecisionsError({ code: DecisionsErrorCode.CommandRefused, params: { refused: plan.refused } })
    return plan
}

/** Plans the command, then runs its `onInserted` hook the way the intake does for a really inserted row. */
const inserted = async (queries: QueryStubs, input: SendCommandInput, row: WorkItem = rowOf()) => {
    const built = await build(queries)
    const plan = planned(await built.service.plan(ctx, input))
    await plan.spec.onInserted?.(row)
    return { ...built, plan }
}

describe("CommandPlannerService instances and announcements", () => {
    describe("the receiving instance", () => {
        it("takes the instance the sender names", async () => {
            const built = await build([[FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Branch 1" }]]])

            const plan = planned(await built.service.plan(ctx, replyOf({ installationId: "inst-1" })))

            expect(plan.spec.installationId).toBe("inst-1")
            expect(built.em.query).toHaveBeenCalledWith(FIND_GIVEN_INSTALLATION, ["ws-1", "chatbot", "inst-1"])
        })

        it("asks the database when the named instance is not the receiver's", async () => {
            const built = await build([
                [FIND_GIVEN_INSTALLATION, []],
                [RESOLVE_INSTALLATION, [{ installation_id: "inst-2", via: "conversation", name: null }]],
            ])

            const plan = planned(await built.service.plan(ctx, replyOf({ installationId: "inst-1" })))

            expect(plan.spec.installationId).toBe("inst-2")
            expect(built.em.query).toHaveBeenCalledWith(RESOLVE_INSTALLATION, [
                "ws-1",
                "chatbot",
                CONVERSATION_ID,
                null,
                null,
            ])
        })

        it("resolves from the conversation in the fields and the customer", async () => {
            const built = await build([
                [RESOLVE_INSTALLATION, [{ installation_id: "inst-3", via: "lead", name: "Branch 3" }]],
            ])

            const plan = planned(
                await built.service.plan(
                    ctx,
                    replyOf({ payload: { subject_type: "lead", lead_id: "lead-9", conversation_id: CONVERSATION_ID } }),
                ),
            )

            expect(plan.spec.installationId).toBe("inst-3")
            expect(built.em.query).toHaveBeenCalledWith(RESOLVE_INSTALLATION, [
                "ws-1",
                "chatbot",
                CONVERSATION_ID,
                "lead-9",
                null,
            ])
        })

        it("resolves without a conversation when the fields name none and the subject is not one", async () => {
            const built = await build([[RESOLVE_INSTALLATION, []]])

            const plan = planned(
                await built.service.plan(
                    ctx,
                    replyOf({ payload: { subject_type: "lead", lead_id: "lead-9", conversation_id: "not-a-uuid" } }),
                ),
            )

            expect(plan.spec.installationId).toBeNull()
            expect(built.em.query).toHaveBeenCalledWith(RESOLVE_INSTALLATION, ["ws-1", "chatbot", null, "lead-9", null])
        })

        it("leaves the database trigger to attribute the item when the lookup fails", async () => {
            const built = await build([["SELECT 1", []]])

            const plan = planned(await built.service.plan(ctx, replyOf()))

            expect(plan.spec.installationId).toBeNull()
            expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.InstanceUnresolved, expect.any(Error), {
                to: "chatbot",
            })
        })
    })

    describe("the Office mirror and the sent evidence", () => {
        it("announces a command that became an item, once inserted", async () => {
            const built = await inserted([[FIND_SUBJECT_LABEL, [{ label: "Lan" }]]], inputOf())

            expect(built.plan.inserted()).toBe(true)
            expect(built.post).toHaveBeenCalledWith(ctx, {
                command: true,
                body: "@Sales <- Owner: classify for customer Lan",
                lead_id: "lead-1",
                work_item_id: "item-1",
            })
            expect(built.log).toHaveBeenCalledWith(ctx, {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "command.sent",
                actor: "Owner",
                summary: "sales.classify_lead",
                evidence: "handoff",
            })
            expect(built.em.query).toHaveBeenCalledWith(FIND_SUBJECT_LABEL, ["ws-1", "lead", "lead-1"])
        })

        it("names the senders: an input, a module and an agent with the name of its instance", async () => {
            const customer = await inserted([[FIND_SUBJECT_LABEL, []]], inputOf({ from: "inbound" }))
            const module = await inserted([[FIND_SUBJECT_LABEL, []]], inputOf({ from: "chatbot" }))
            const agent = await inserted(
                [
                    [FIND_SENDER_AGENT, [{ name: "Bot", module: "chatbot", installation_name: "Branch 1" }]],
                    [FIND_SUBJECT_LABEL, []],
                ],
                inputOf({ from: AGENT_ID }),
            )

            expect(customer.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Customer: classify")
            expect(module.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Chatbot: classify")
            expect(agent.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Chatbot – Branch 1: classify")
        })

        it("ignores the instance name of an agent of a single-instance type, and names an unregistered agent by itself", async () => {
            const single = await inserted(
                [
                    [FIND_SENDER_AGENT, [{ name: "Ann", module: "sales", installation_name: "Main" }]],
                    [FIND_SUBJECT_LABEL, []],
                ],
                inputOf({ from: AGENT_ID }),
            )
            const free = await inserted(
                [
                    [FIND_SENDER_AGENT, [{ name: "Free Agent", module: "custom", installation_name: null }]],
                    [FIND_SUBJECT_LABEL, []],
                ],
                inputOf({ from: AGENT_ID }),
            )

            expect(single.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Sales: classify")
            expect(free.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Free Agent: classify")
        })

        it("prefixes an order number and leaves a kind without a word as the bare label", async () => {
            const order = await inserted(
                [[FIND_SUBJECT_LABEL, [{ label: "DH-1" }]]],
                inputOf({ payload: { lead_id: "lead-1", subject_type: "order", subject_id: "order-1" } }),
            )
            const stock = await inserted(
                [[FIND_SUBJECT_LABEL, [{ label: "Rice" }]]],
                inputOf({ payload: { lead_id: "lead-1", subject_type: "stock", subject_id: "stock-1" } }),
            )

            expect(order.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Owner: classify for order #DH-1")
            expect(stock.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Owner: classify for Rice")
        })

        it("goes without a subject when it has no id or no readable label, and never blocks on a label", async () => {
            const noId = await inserted([], inputOf({ payload: { lead_id: "lead-1" } }))
            const blank = await inserted([[FIND_SUBJECT_LABEL, [{ label: null }]]], inputOf())
            const none = await inserted([[FIND_SUBJECT_LABEL, []]], inputOf())
            const broken = await inserted([["SELECT 1", []]], inputOf())

            for (const built of [noId, blank, none, broken]) {
                expect(built.post.mock.calls[0]?.[1]?.body).toBe("@Sales <- Owner: classify")
            }
            expect(broken.error).toHaveBeenCalledWith(WorkEngineLogEvent.SubjectLabelUnreadable, expect.any(Error), {
                subjectType: "lead",
            })
        })

        it("records the instance that was chosen and how", async () => {
            const named = await inserted(
                [[FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Branch 1" }]]],
                replyOf({ installationId: "inst-1" }),
            )
            const unnamed = await inserted(
                [[RESOLVE_INSTALLATION, [{ installation_id: "inst-2", via: "first", name: null }]]],
                replyOf(),
            )

            expect(named.post.mock.calls[0]?.[1]?.body).toBe("@Chatbot – Branch 1 <- Owner: reply")
            expect(named.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    summary: "chatbot[Branch 1].reply_customer",
                    evidence: "handoff · instance inst-1 (given)",
                }),
            )
            expect(unnamed.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    summary: "chatbot[inst-2].reply_customer",
                    evidence: "handoff · instance inst-2 (first)",
                }),
            )
        })

        it("lets neither the Office nor the evidence log block the command", async () => {
            const built = await build([[FIND_SUBJECT_LABEL, []]])
            built.post.mockRejectedValue(new RangeError("office"))
            built.log.mockRejectedValue(new RangeError("log"))
            const plan = planned(await built.service.plan(ctx, inputOf()))

            await plan.spec.onInserted?.(rowOf())

            expect(built.error.mock.calls.map(([event]) => event)).toEqual([
                WorkEngineLogEvent.OfficeFailed,
                WorkEngineLogEvent.EvidenceFailed,
            ])
        })
    })
})
