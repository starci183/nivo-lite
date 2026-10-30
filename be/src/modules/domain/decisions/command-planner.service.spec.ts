import { mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { OfficeLinesService } from "@modules/domain/messages"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { OrdersLabelReadService } from "@modules/domain/orders"
import { WorkItemsChainReadService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CommandPlannerService } from "./command-planner.service"
import type { CommandRefusal, SendCommandInput, WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import type { CommandPlan, PlannedCommand } from "./work-engine.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import {
    ctx,
    AGENT_ID,
    CONVERSATION_ID,
    MODULES,
    plannerText,
    inputOf,
    replyOf,
    rowOf,
} from "@tests/fixtures/builders/command-planner.builder"
import {
    CHAIN_REPEATS_COMMAND,
    FIND_CHAIN_TOP,
    FIND_GIVEN_INSTALLATION,
    FIND_PARENT_POSITION,
    FIND_SENDER_AGENT,
    FIND_SUBJECT_LABEL,
    RESOLVE_INSTALLATION,
    UNREADABLE,
    answer,
    serve,
} from "@tests/fixtures/builders/command-planner-owners.builder"
import type { Queries, Served } from "@tests/fixtures/builders/command-planner-owners.builder"

const build = async (stage: Served = serve()) => {
    const agents = mock<AgentDirectoryService>()
    const installations = mock<InstallationRecordsService>()
    const chains = mock<WorkItemsChainReadService>()
    const orders = mock<OrdersLabelReadService>()
    const leads = mock<LeadReadService>()
    const invoices = mock<InvoicesLedgerService>()
    answer(stage.queries, { agents, installations, chains, orders, leads, invoices })
    const served = { em: stage.em, agents, installations, chains, orders, leads, invoices }
    const log = jest.fn().mockResolvedValue(undefined)
    const post = jest.fn<Promise<void>, Parameters<OfficeLinesService["post"]>>().mockResolvedValue(undefined)
    const error = jest.fn<void, Parameters<Logger["error"]>>()
    const modules = mock<ModuleCatalogService>({
        entryOf: jest.fn((key: string) => Promise.resolve(MODULES[key] ?? null)),
        nameOf: jest.fn((key: string) => Promise.resolve(MODULES[key]?.name.en ?? key)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            CommandPlannerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: served.em },
            { provide: LOGGER, useValue: mock<Logger>({ error }) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>({ get: jest.fn(plannerText) }) },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ log }) },
            { provide: OfficeLinesService, useValue: mock<OfficeLinesService>({ post }) },
            { provide: AgentDirectoryService, useValue: agents },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: WorkItemsChainReadService, useValue: chains },
            { provide: OrdersLabelReadService, useValue: orders },
            { provide: LeadReadService, useValue: leads },
            { provide: InvoicesLedgerService, useValue: invoices },
        ],
    }).compile()
    return { service: moduleRef.get(CommandPlannerService), served, em: served.em, log, post, error, modules }
}

const planned = (plan: CommandPlan): PlannedCommand => {
    if (!plan.ok)
        throw new DecisionsError({ code: DecisionsErrorCode.CommandRefused, params: { refused: plan.refused } })
    return plan
}

/** Plans the command, then runs its `onInserted` hook the way the intake does for a really inserted row. */
const inserted = async (served: Served, input: SendCommandInput, row: WorkItem = rowOf()) => {
    const built = await build(served)
    const plan = planned(await built.service.plan(ctx, input))
    await plan.spec.onInserted?.(row)
    return { ...built, plan }
}

const refusal = (
    name: string,
    input: SendCommandInput,
    refused: CommandRefusal,
    detail: string,
    queries: Queries = [],
    missing?: ReadonlyArray<string>,
) => [name, input, { ok: false, refused, detail, ...(missing ? { missing } : {}) }, queries] as const

const refusalCases = [
    refusal("an unknown module", inputOf({ to: "mystery" }), "unknown_module", "no agent mystery"),
    refusal("an unknown command", inputOf({ command: "dance" }), "unknown_command", "sales does not accept dance"),
    refusal("an unknown sender", inputOf({ from: "stranger" }), "unknown_sender", "no sender stranger"),
    refusal("an absent agent", inputOf({ from: AGENT_ID }), "unknown_sender", `no sender ${AGENT_ID}`, [
        [FIND_SENDER_AGENT, []],
    ]),
    refusal(
        "missing payload keys",
        inputOf({ payload: { subject_id: "lead-1" } }),
        "missing_fields",
        "sales.classify_lead needs lead_id",
        [],
        ["lead_id"],
    ),
    refusal(
        "an invalid subject kind",
        inputOf({ payload: { lead_id: "lead-1", subject_type: "planet" } }),
        "missing_fields",
        "planet is not a kind of record",
        [],
        ["subject_type"],
    ),
    refusal("a deep chain", inputOf({ parentId: "parent-1" }), "too_deep", "depth 7 is deeper than the chain allows", [
        [FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: "chain-1", depth: 6 }]],
    ]),
    refusal("a cycle", inputOf({ chainId: "chain-1" }), "cycle", "classify_lead on lead already ran in chain chain-1", [
        [FIND_CHAIN_TOP, [{ depth: 1 }]],
        [CHAIN_REPEATS_COMMAND, [{ repeats: true }]],
    ]),
]

describe("CommandPlannerService", () => {
    describe("a producer's domain transaction", () => {
        it("keeps command lookups, mirror and evidence in the supplied transaction", async () => {
            const manager = serve([
                [FIND_SENDER_AGENT, [{ name: "Bot", module: "chatbot", installation_name: "Main" }]],
                [FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: "chain-1", depth: 0 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
                [FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Main" }]],
                [FIND_SUBJECT_LABEL, [{ label: "Lan" }]],
            ])
            const own = mockEntityManager()
            const built = await build({ ...manager, em: own })
            const input = replyOf({ from: AGENT_ID, parentId: "parent-1", installationId: "inst-1" })
            const plan = planned(await built.service.plan(ctx, input, manager.em))

            await plan.spec.onInserted?.(rowOf())

            expect(own.createQueryBuilder).not.toHaveBeenCalled()
            expect(built.served.chains.spotOf).toHaveBeenCalledWith("ws-1", "parent-1", manager.em)
            expect(built.served.chains.repeats).toHaveBeenCalledWith(
                expect.objectContaining({ chainId: "chain-1" }),
                manager.em,
            )
            expect(built.modules.entryOf).toHaveBeenCalledWith("chatbot")
            expect(built.post).toHaveBeenCalledWith(ctx, expect.objectContaining({ command: true }), manager.em)
            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "command.sent" }), manager.em)
        })

        it("records a refused command in the supplied transaction", async () => {
            const built = await build()
            const manager = mockEntityManager()

            expect((await built.service.plan(ctx, inputOf({ to: "missing" }), manager)).ok).toBe(false)

            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "command.refused" }), manager)
        })
    })
})

describe("CommandPlannerService", () => {
    describe("refusals", () => {
        it.each(refusalCases)("refuses %s", async (_name, input, expected, queries) => {
            const built = await build(serve(queries))
            expect(await built.service.plan(ctx, input)).toEqual(expected)
            expect(built.log).toHaveBeenCalledTimes(1)
            const evidence = { kind: "command.refused", actor: "NIVO", evidence: expected.detail }
            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining(evidence), built.em)
            const summary: unknown = expect.objectContaining({
                summary: "owner -> mystery.classify_lead: unknown_module",
            })
            if (input.to === "mystery") expect(built.log).toHaveBeenCalledWith(ctx, summary, built.em)
            const cycle = {
                ...{ workspaceId: "ws-1", chainId: "chain-1", action: "classify_lead", subjectType: "lead" },
                ...{ dedupeKey: "cmd:classify_lead:lead:lead-1", subjectId: "lead-1" },
            }
            if (expected.refused === "cycle") expect(built.served.chains.repeats).toHaveBeenCalledWith(cycle, built.em)
        })
    })
})

describe("CommandPlannerService", () => {
    describe("refusals", () => {
        it("survives an evidence log that is down", async () => {
            const built = await build()
            built.log.mockRejectedValue(new RangeError("down"))
            const plan = await built.service.plan(ctx, inputOf({ to: "mystery" }))
            expect(plan.ok).toBe(false)
            expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.EvidenceFailed, expect.any(RangeError))
        })
    })

    describe("a planned command", () => {
        it("becomes a spec addressed to the receiver, with the payload fields in the seed", async () => {
            const built = await build()

            const payload = { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1", note: "vip" }
            const input = inputOf({ payload, seed: { summary: "S", fields: { a: 1 } }, inboundEventId: "in-1" })
            Object.assign(input, { queue: true, preset: true, noChain: true, forceAsk: "unclear_outcome" })
            Object.assign(input, { dedupeKey: "key-1" })
            const plan = planned(await built.service.plan(ctx, input))

            expect(plan.depth).toBe(0)
            expect(plan.inserted()).toBe(false)
            const address = { action: "classify_lead", subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" }
            const flags = { queue: true, preset: true, noChain: true, forceAsk: "unclear_outcome" }
            const place = { chainId: null, depth: 0, installationId: null, parent_id: null }
            const seed = { summary: "S", fields: { a: 1, note: "vip" } }
            const keys = { inbound_event_id: "in-1", dedupeKey: "key-1" }
            expect(plan.spec).toEqual(expect.objectContaining({ ...address, ...flags, ...place, ...keys, seed }))
        })

        it.each<readonly [string, SendCommandInput, string | null, string]>([
            ["a named subject", inputOf(), "lead-1", "cmd:classify_lead:lead:lead-1"],
            ["an unnamed kind", inputOf({ payload: { lead_id: "lead-1" } }), null, "cmd:classify_lead:lead:none"],
        ])("defaults the dedupe key and seed for %s", async (_name, input, subjectId, dedupeKey) => {
            const built = await build()
            const plan = planned(await built.service.plan(ctx, input))
            expect(plan.spec.dedupeKey).toBe(dedupeKey)
            expect(plan.spec.seed).toEqual({ fields: {} })
            expect(plan.spec.subject_type).toBe("lead")
            expect(plan.spec.subject_id).toBe(subjectId)
        })
    })
})

describe("CommandPlannerService", () => {
    describe("the place in the chain", () => {
        const parent = (chain_id: string | null, depth: number) => [{ id: "parent-1", chain_id, depth }]
        const parentInput = { parentId: "parent-1" }
        const namedInput = { ...parentInput, chainId: "chain-1" }
        const missingInput = { parentId: "gone", chainId: "chain-1" }
        const position = (
            name: string,
            input: Partial<SendCommandInput>,
            sql: string,
            rows: unknown,
            depth: number,
            chainId: string,
            repeats: boolean | null = false,
        ) => [name, inputOf(input), sql, rows, depth, chainId, repeats] as const

        it.each([
            position("after its parent", parentInput, FIND_PARENT_POSITION, parent("chain-1", 2), 3, "chain-1"),
            position("in its named chain", namedInput, FIND_PARENT_POSITION, parent("chain-9", 0), 1, "chain-1"),
            position("in an unchained parent", parentInput, FIND_PARENT_POSITION, parent(null, 0), 1, "parent-1"),
            position("at its missing parent's root", missingInput, FIND_PARENT_POSITION, [], 0, "chain-1"),
            position("after the deepest item", { chainId: "chain-1" }, FIND_CHAIN_TOP, [{ depth: 3 }], 4, "chain-1"),
            position("at depth one in an empty chain", { chainId: "chain-1" }, FIND_CHAIN_TOP, [], 1, "chain-1", null),
        ])("places a command %s", async (_name, input, sql, rows, depth, chainId, repeats) => {
            const query: Queries = [
                [sql, rows],
                [CHAIN_REPEATS_COMMAND, repeats === null ? [] : [{ repeats }]],
            ]
            const built = await build(serve(query))
            const plan = planned(await built.service.plan(ctx, input))
            expect(plan.depth).toBe(depth)
            expect(plan.spec.chainId).toBe(chainId)
            expect(plan.spec.parent_id).toBe(input.parentId ?? null)
        })
    })
})

describe("CommandPlannerService", () => {
    describe("the receiving instance", () => {
        const resolved = (id: string, via: string, name: string | null): Queries => [
            [RESOLVE_INSTALLATION, [{ installation_id: id, via, name }]],
        ]
        const fields = (conversation_id: string) => ({ subject_type: "lead", lead_id: "lead-9", conversation_id })
        const instance = (
            name: string,
            input: Partial<SendCommandInput>,
            id: string | null,
            query: Queries,
            sql: string,
            params: ReadonlyArray<unknown>,
        ) => [name, replyOf(input), id, query, sql, params] as const
        it.each([
            instance(
                "the named instance",
                { installationId: "inst-1" },
                "inst-1",
                [[FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Branch 1" }]]],
                FIND_GIVEN_INSTALLATION,
                ["ws-1", "chatbot", "inst-1"],
            ),
            instance(
                "a resolved instance when the named one is absent",
                { installationId: "inst-1" },
                "inst-2",
                [[FIND_GIVEN_INSTALLATION, []], ...resolved("inst-2", "conversation", null)],
                RESOLVE_INSTALLATION,
                ["ws-1", "chatbot", CONVERSATION_ID, null, null],
            ),
            instance(
                "from conversation and customer fields",
                { payload: fields(CONVERSATION_ID) },
                "inst-3",
                resolved("inst-3", "lead", "Branch 3"),
                RESOLVE_INSTALLATION,
                ["ws-1", "chatbot", CONVERSATION_ID, "lead-9", null],
            ),
            instance(
                "without an invalid conversation",
                { payload: fields("not-a-uuid") },
                null,
                [[RESOLVE_INSTALLATION, []]],
                RESOLVE_INSTALLATION,
                ["ws-1", "chatbot", null, "lead-9", null],
            ),
        ])("chooses %s", async (_name, input, id, query, sql, params) => {
            const built = await build(serve(query))
            const plan = planned(await built.service.plan(ctx, input))
            expect(plan.spec.installationId).toBe(id)
            if (sql === RESOLVE_INSTALLATION) expect(built.em.query).toHaveBeenCalledWith(sql, params)
            else expect(built.served.installations.find).toHaveBeenCalledWith(params[0], params[2])
        })

        it("leaves the database trigger to attribute the item when the lookup fails", async () => {
            const built = await build(serve([[UNREADABLE, []]]))

            const plan = planned(await built.service.plan(ctx, replyOf()))

            expect(plan.spec.installationId).toBeNull()
            const unresolved = WorkEngineLogEvent.InstanceUnresolved
            expect(built.error).toHaveBeenCalledWith(unresolved, expect.any(Error), { to: "chatbot" })
        })
    })
})

describe("CommandPlannerService", () => {
    describe("the Office mirror and the sent evidence", () => {
        const label = (value: string | null): Queries => [[FIND_SUBJECT_LABEL, [{ label: value }]]]
        const agent = (name: string, module: string, installation_name: string | null): Queries => [
            [FIND_SENDER_AGENT, [{ name, module, installation_name }]],
            [FIND_SUBJECT_LABEL, []],
        ]
        const mirror = (
            name: string,
            body: string,
            input: Partial<SendCommandInput> = {},
            query: Queries = [[FIND_SUBJECT_LABEL, []]],
            failed = false,
        ) => [name, body, inputOf(input), query, failed] as const
        const subject = (kind: string) => ({ lead_id: "lead-1", subject_type: kind, subject_id: `${kind}-1` })
        it("announces a command that became an item, once inserted", async () => {
            const built = await inserted(serve([[FIND_SUBJECT_LABEL, [{ label: "Lan" }]]]), inputOf())

            expect(built.plan.inserted()).toBe(true)
            const ids = { lead_id: "lead-1", work_item_id: "item-1" }
            const body = "@Sales <- Owner: classify for customer Lan"
            const sent = { kind: "command.sent", actor: "Owner", summary: "sales.classify_lead", evidence: "handoff" }
            expect(built.post).toHaveBeenCalledWith(ctx, { command: true, body, ...ids }, built.em)
            expect(built.log).toHaveBeenCalledWith(ctx, { ...ids, ...sent }, built.em)
            expect(built.served.leads.cardsOf).toHaveBeenCalledWith("ws-1", ["lead-1"])
        })

        it.each([
            mirror("an inbound sender", "Customer: classify", { from: "inbound" }),
            mirror("a module sender", "Chatbot: classify", { from: "chatbot" }),
            mirror(
                "a multi-instance agent",
                "Chatbot \u2013 Branch 1: classify",
                { from: AGENT_ID },
                agent("Bot", "chatbot", "Branch 1"),
            ),
            mirror(
                "a multi-instance agent with no installation",
                "Chatbot: classify",
                { from: AGENT_ID },
                agent("Bot", "chatbot", null),
            ),
            mirror("a single-instance agent", "Sales: classify", { from: AGENT_ID }, agent("Ann", "sales", "Main")),
            mirror(
                "an unregistered agent",
                "Free Agent: classify",
                { from: AGENT_ID },
                agent("Free Agent", "custom", null),
            ),
            mirror("an order number", "Owner: classify for order #DH-1", { payload: subject("order") }, label("DH-1")),
            mirror("an untranslated kind", "Owner: classify for Rice", { payload: subject("invoice") }, label("Rice")),
            mirror("an order without a number", "Owner: classify", { payload: subject("order") }, label(null)),
            mirror("an invoice without a receipt", "Owner: classify", { payload: subject("invoice") }, label(null)),
            mirror("no subject id", "Owner: classify", { payload: { lead_id: "lead-1" } }, []),
            mirror("a blank label", "Owner: classify", {}, label(null)),
            mirror("no label row", "Owner: classify"),
            mirror("an unreadable label", "Owner: classify", {}, [[UNREADABLE, []]], true),
        ])("mirrors %s", async (_name, body, input, query, failed) => {
            const built = await inserted(serve(query), input)
            expect(built.post.mock.calls[0]?.[1]?.body).toBe(`@Sales <- ${body}`)
            if (failed)
                expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.SubjectLabelUnreadable, expect.any(Error), {
                    subjectType: "lead",
                })
        })
    })
})

describe("CommandPlannerService", () => {
    describe("the Office mirror and the sent evidence", () => {
        it.each([
            [
                "named",
                serve([[FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Branch 1" }]]]),
                { installationId: "inst-1" },
            ],
            [
                "resolved",
                serve([[RESOLVE_INSTALLATION, [{ installation_id: "inst-2", via: "first", name: null }]]]),
                {},
            ],
        ])("records the instance that was chosen and how: %s", async (kind, manager, changes) => {
            const built = await inserted(manager, replyOf(changes))
            const [summary, evidence] =
                kind === "named"
                    ? ["chatbot[Branch 1].reply_customer", "handoff · instance inst-1 (given)"]
                    : ["chatbot[inst-2].reply_customer", "handoff · instance inst-2 (first)"]

            expect(built.post.mock.calls[0]?.[1]?.body).toBe(
                kind === "named" ? "@Chatbot – Branch 1 <- Owner: reply" : "@Chatbot <- Owner: reply",
            )
            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ summary, evidence }), built.em)
        })

        it("lets neither the Office nor the evidence log block the command", async () => {
            const built = await build(serve([[FIND_SUBJECT_LABEL, []]]))
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

describe("CommandPlannerService", () => {
    describe("a named instance that can not be used", () => {
        it("ignores a named instance that belongs to another module", async () => {
            const built = await build()
            built.served.installations.find.mockResolvedValue(
                mock<InstallationRecord>({ id: "inst-1", name: "Branch 1", moduleKey: "sales" }),
            )

            const plan = planned(await built.service.plan(ctx, replyOf({ installationId: "inst-1" })))

            expect(plan.spec.installationId).toBeNull()
            expect(built.served.installations.find).toHaveBeenCalledWith("ws-1", "inst-1")
        })

        it("does not look up a named instance that is null", async () => {
            const built = await build()

            const plan = planned(await built.service.plan(ctx, replyOf({ installationId: null })))

            expect(plan.spec.installationId).toBeNull()
            expect(built.served.installations.find).not.toHaveBeenCalled()
        })
    })
})
