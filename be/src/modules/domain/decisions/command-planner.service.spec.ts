import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
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
import { OfficeLinesService } from "@modules/domain/messages"
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
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import type { TableAnswers, TableQuery } from "@tests/fixtures/builders/table-query-builder.builder"

type Queries = ReadonlyArray<readonly [string, unknown]>

/** The reads of the planner, named. Each one is a query builder on a table, except the resolver, which is a database function. */
const FIND_SENDER_AGENT = "sender agent"
const FIND_PARENT_POSITION = "parent position"
const FIND_CHAIN_TOP = "chain top"
const CHAIN_REPEATS_COMMAND = "chain repeats"
const FIND_GIVEN_INSTALLATION = "given installation"
const FIND_SUBJECT_LABEL = "subject label"
/** The statement `callDbFunction` sends for the resolver. */
const RESOLVE_INSTALLATION = "SELECT * FROM public.resolve_installation($1, $2, $3, $4, $5)"
/** Stands for a lookup that fails: every read of the manager rejects. */
const UNREADABLE = "SELECT 1"

/** What every manager built by `serve` saw. */
const SEEN = new WeakMap<MockEntityManager, TableAnswers>()

const rowsAt = (queries: Queries, key: string): ReadonlyArray<Record<string, unknown>> => {
    const rows = queries.find(([name]) => name === key)?.[1]
    return Array.isArray(rows) ? rows : []
}

/** A manager that answers the named reads with their rows; with no reads it is strict and answers nothing. */
const serve = (queries: Queries = []): MockEntityManager => {
    if (queries.length === 0) return mockEntityManager()
    const resolved = rowsAt(queries, RESOLVE_INSTALLATION)
    const em = queries.some(([key]) => key === RESOLVE_INSTALLATION)
        ? mockEntityManager({
              query: [RESOLVE_INSTALLATION, resolved.map(({ installation_id, via }) => ({ installation_id, via }))],
          })
        : mockEntityManager()
    const failing = queries.some(([key]) => key === UNREADABLE)
    const answer = (rows: ReadonlyArray<unknown>) => (failing ? Promise.reject(new RangeError("lookup failed")) : rows)
    const label = () => answer(rowsAt(queries, FIND_SUBJECT_LABEL))
    SEEN.set(
        em,
        answerByTable(em, {
            "public.agents": () => answer(rowsAt(queries, FIND_SENDER_AGENT)),
            "public.work_items": (query: TableQuery) => {
                const alias = query.callsOf("select")[0]?.[1]
                if (alias === "id") return answer(rowsAt(queries, FIND_PARENT_POSITION))
                if (alias === "depth") return answer(rowsAt(queries, FIND_CHAIN_TOP))
                return answer(rowsAt(queries, CHAIN_REPEATS_COMMAND).filter((row) => row.repeats === true))
            },
            "public.module_installations": (query: TableQuery) =>
                query.callsOf("addSelect").length > 0
                    ? answer(rowsAt(queries, FIND_GIVEN_INSTALLATION))
                    : answer(resolved.map(({ name }) => ({ name }))),
            "public.orders": label,
            "public.leads": label,
            "public.invoices": label,
        }),
    )
    return em
}

/** The queries of one table that a manager built by `serve` saw. */
const readsOf = (em: MockEntityManager, table: string): ReadonlyArray<TableQuery> =>
    SEEN.get(em)?.queriesOf(table) ?? []

const build = async (em: MockEntityManager) => {
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
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: LOGGER, useValue: mock<Logger>({ error }) },
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({
                    get: jest.fn(plannerText),
                }),
            },
            {
                provide: ModuleCatalogService,
                useValue: modules,
            },
            { provide: EvidenceService, useValue: mock<EvidenceService>({ log }) },
            { provide: OfficeLinesService, useValue: mock<OfficeLinesService>({ post }) },
        ],
    }).compile()
    return { service: moduleRef.get(CommandPlannerService), em, log, post, error, modules }
}

const planned = (plan: CommandPlan): PlannedCommand => {
    if (!plan.ok)
        throw new DecisionsError({ code: DecisionsErrorCode.CommandRefused, params: { refused: plan.refused } })
    return plan
}

/** Plans the command, then runs its `onInserted` hook the way the intake does for a really inserted row. */
const inserted = async (em: MockEntityManager, input: SendCommandInput, row: WorkItem = rowOf()) => {
    const built = await build(em)
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
            const em = mockEntityManager()
            const manager = serve([
                [FIND_SENDER_AGENT, [{ name: "Bot", module: "chatbot", installation_name: "Main" }]],
                [FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: "chain-1", depth: 0 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
                [FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Main" }]],
                [FIND_SUBJECT_LABEL, [{ label: "Lan" }]],
            ])
            const built = await build(em)
            const plan = planned(
                await built.service.plan(
                    ctx,
                    replyOf({
                        from: AGENT_ID,
                        parentId: "parent-1",
                        installationId: "inst-1",
                    }),
                    manager,
                ),
            )

            await plan.spec.onInserted?.(rowOf())

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
            // A conversation subject has no label table, so the label is not read at all.
            expect(manager.createQueryBuilder).toHaveBeenCalledTimes(4)
            expect(built.modules.entryOf).toHaveBeenCalledWith("chatbot", manager)
            expect(built.modules.nameOf).toHaveBeenCalledWith("chatbot", "en", manager)
            expect(built.post).toHaveBeenCalledWith(ctx, expect.objectContaining({ command: true }), manager)
            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "command.sent" }), manager)
        })

        it("records a refused command in the supplied transaction", async () => {
            const built = await build(mockEntityManager())
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
            if (input.to === "mystery")
                expect(built.log).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({
                        summary: "owner -> mystery.classify_lead: unknown_module",
                    }),
                    built.em,
                )
            if (expected.refused === "cycle")
                expect(
                    readsOf(built.em, "public.work_items").map((query) => query.callsOf("where")[0]?.[1]),
                ).toContainEqual({
                    workspaceId: "ws-1",
                    chainId: "chain-1",
                    action: "classify_lead",
                    subjectType: "lead",
                    dedupeKey: "cmd:classify_lead:lead:lead-1",
                    subjectId: "lead-1",
                })
        })
    })
})

describe("CommandPlannerService", () => {
    describe("refusals", () => {
        it("survives an evidence log that is down", async () => {
            const built = await build(mockEntityManager({}))
            built.log.mockRejectedValue(new RangeError("down"))
            const plan = await built.service.plan(ctx, inputOf({ to: "mystery" }))
            expect(plan.ok).toBe(false)
            expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.EvidenceFailed, expect.any(RangeError))
        })
    })

    describe("a planned command", () => {
        it("becomes a spec addressed to the receiver, with the payload fields in the seed", async () => {
            const built = await build(mockEntityManager({}))

            const input = inputOf({
                payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1", note: "vip" },
                seed: { summary: "S", fields: { a: 1 } },
                inboundEventId: "in-1",
                queue: true,
                preset: true,
                noChain: true,
                forceAsk: "unclear_outcome",
                dedupeKey: "key-1",
            })
            const plan = planned(await built.service.plan(ctx, input))

            expect(plan.depth).toBe(0)
            expect(plan.inserted()).toBe(false)
            expect(plan.spec).toEqual(
                expect.objectContaining({
                    action: "classify_lead",
                    subject_type: "lead",
                    subject_id: "lead-1",
                    lead_id: "lead-1",
                    inbound_event_id: "in-1",
                    parent_id: null,
                    dedupeKey: "key-1",
                    seed: { summary: "S", fields: { a: 1, note: "vip" } },
                    queue: true,
                    preset: true,
                    noChain: true,
                    forceAsk: "unclear_outcome",
                    chainId: null,
                    depth: 0,
                    installationId: null,
                }),
            )
        })

        it.each<readonly [string, SendCommandInput, string | null, string]>([
            ["a named subject", inputOf(), "lead-1", "cmd:classify_lead:lead:lead-1"],
            ["an unnamed kind", inputOf({ payload: { lead_id: "lead-1" } }), null, "cmd:classify_lead:lead:none"],
        ])("defaults the dedupe key and seed for %s", async (_name, input, subjectId, dedupeKey) => {
            const built = await build(mockEntityManager({}))
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
            else
                expect(readsOf(built.em, "public.module_installations")[0]?.callsOf("where")[0]?.[1]).toEqual({
                    workspaceId: params[0],
                    moduleKey: params[1],
                    installationId: params[2],
                })
        })

        it("leaves the database trigger to attribute the item when the lookup fails", async () => {
            const built = await build(serve([[UNREADABLE, []]]))

            const plan = planned(await built.service.plan(ctx, replyOf()))

            expect(plan.spec.installationId).toBeNull()
            expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.InstanceUnresolved, expect.any(Error), {
                to: "chatbot",
            })
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
            expect(built.post).toHaveBeenCalledWith(
                ctx,
                {
                    command: true,
                    body: "@Sales <- Owner: classify for customer Lan",
                    lead_id: "lead-1",
                    work_item_id: "item-1",
                },
                built.em,
            )
            expect(built.log).toHaveBeenCalledWith(
                ctx,
                {
                    lead_id: "lead-1",
                    work_item_id: "item-1",
                    kind: "command.sent",
                    actor: "Owner",
                    summary: "sales.classify_lead",
                    evidence: "handoff",
                },
                built.em,
            )
            expect(readsOf(built.em, "public.leads").map((query) => query.callsOf("where")[0]?.[1])).toEqual([
                { workspaceId: "ws-1", subjectId: "lead-1" },
            ])
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
            mirror("a single-instance agent", "Sales: classify", { from: AGENT_ID }, agent("Ann", "sales", "Main")),
            mirror(
                "an unregistered agent",
                "Free Agent: classify",
                { from: AGENT_ID },
                agent("Free Agent", "custom", null),
            ),
            mirror("an order number", "Owner: classify for order #DH-1", { payload: subject("order") }, label("DH-1")),
            mirror("an untranslated kind", "Owner: classify for Rice", { payload: subject("invoice") }, label("Rice")),
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
        it("records the instance that was chosen and how", async () => {
            const named = await inserted(
                serve([[FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Branch 1" }]]]),
                replyOf({ installationId: "inst-1" }),
            )
            const unnamed = await inserted(
                serve([[RESOLVE_INSTALLATION, [{ installation_id: "inst-2", via: "first", name: null }]]]),
                replyOf(),
            )

            expect(named.post.mock.calls[0]?.[1]?.body).toBe("@Chatbot \u2013 Branch 1 <- Owner: reply")
            expect(named.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    summary: "chatbot[Branch 1].reply_customer",
                    evidence: "handoff \u00b7 instance inst-1 (given)",
                }),
                named.em,
            )
            expect(unnamed.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    summary: "chatbot[inst-2].reply_customer",
                    evidence: "handoff \u00b7 instance inst-2 (first)",
                }),
                unnamed.em,
            )
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
