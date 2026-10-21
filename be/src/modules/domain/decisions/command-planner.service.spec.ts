import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CommandPlannerService } from "./command-planner.service"
import type { CommandRefusal, ModuleEntry, SendCommandInput, WorkContext, WorkItem } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { OfficeLinesService } from "@modules/domain/messages"
import {
    CHAIN_REPEATS_COMMAND,
    FIND_CHAIN_TOP,
    FIND_GIVEN_INSTALLATION,
    FIND_PARENT_POSITION,
    FIND_SENDER_AGENT,
    FIND_SUBJECT_LABEL,
    RESOLVE_INSTALLATION,
} from "./persistence/command-bus.sql"
import type { CommandPlan, PlannedCommand } from "./work-engine.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
const AGENT_ID = "2f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
const CONVERSATION_ID = "3f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"
type Queries = ReadonlyArray<readonly [string, unknown]>

const commandOf = builder<ModuleEntry["accepts"][number]>({
    command: "classify_lead",
    action: "classify_lead",
    subjectType: "lead",
    requiredFields: ["lead_id"],
    description: { vi: "phan loai", en: "classify" },
})

const moduleOf = builder<ModuleEntry>({
    key: "sales",
    audience: "internal",
    multiInstance: false,
    name: { vi: "Ban hang", en: "Sales" },
    accepts: [commandOf()],
})

const chatbot = moduleOf({
    key: "chatbot",
    multiInstance: true,
    name: { vi: "Chatbot", en: "Chatbot" },
    accepts: [
        commandOf({
            command: "reply_customer",
            action: "reply_customer",
            subjectType: "conversation",
            requiredFields: [],
            description: { vi: "tra loi", en: "reply" },
        }),
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

const rowOf = (): WorkItem => mock<WorkItem>({ id: "item-1", lead_id: "lead-1" })

const build = async (em: MockEntityManager) => {
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
    describe("refusals", () => {
        it.each(refusalCases)("refuses %s", async (_name, input, expected, queries) => {
            const built = await build(mockEntityManager({ query: queries }))
            expect(await built.service.plan(ctx, input)).toEqual(expected)
            expect(built.log).toHaveBeenCalledTimes(1)
            const evidence = { kind: "command.refused", actor: "NIVO", evidence: expected.detail }
            expect(built.log).toHaveBeenCalledWith(ctx, expect.objectContaining(evidence))
            if (input.to === "mystery")
                expect(built.log).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({
                        summary: "owner -> mystery.classify_lead: unknown_module",
                    }),
                )
            if (expected.refused === "cycle")
                expect(built.em.query).toHaveBeenCalledWith(CHAIN_REPEATS_COMMAND, [
                    "ws-1",
                    "chain-1",
                    "classify_lead",
                    "lead",
                    "cmd:classify_lead:lead:lead-1",
                    "lead-1",
                ])
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
            const built = await build(mockEntityManager({ query }))
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
            const built = await build(mockEntityManager({ query }))
            const plan = planned(await built.service.plan(ctx, input))
            expect(plan.spec.installationId).toBe(id)
            expect(built.em.query).toHaveBeenCalledWith(sql, params)
        })

        it("leaves the database trigger to attribute the item when the lookup fails", async () => {
            const built = await build(mockEntityManager({ query: [["SELECT 1", []]] }))

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
            const built = await inserted(
                mockEntityManager({ query: [[FIND_SUBJECT_LABEL, [{ label: "Lan" }]]] }),
                inputOf(),
            )

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
            mirror("an untranslated kind", "Owner: classify for Rice", { payload: subject("stock") }, label("Rice")),
            mirror("no subject id", "Owner: classify", { payload: { lead_id: "lead-1" } }, []),
            mirror("a blank label", "Owner: classify", {}, label(null)),
            mirror("no label row", "Owner: classify"),
            mirror("an unreadable label", "Owner: classify", {}, [["SELECT 1", []]], true),
        ])("mirrors %s", async (_name, body, input, query, failed) => {
            const built = await inserted(mockEntityManager({ query }), input)
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
                mockEntityManager({ query: [[FIND_GIVEN_INSTALLATION, [{ id: "inst-1", name: "Branch 1" }]]] }),
                replyOf({ installationId: "inst-1" }),
            )
            const unnamed = await inserted(
                mockEntityManager({
                    query: [[RESOLVE_INSTALLATION, [{ installation_id: "inst-2", via: "first", name: null }]]],
                }),
                replyOf(),
            )

            expect(named.post.mock.calls[0]?.[1]?.body).toBe("@Chatbot \u2013 Branch 1 <- Owner: reply")
            expect(named.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    summary: "chatbot[Branch 1].reply_customer",
                    evidence: "handoff \u00b7 instance inst-1 (given)",
                }),
            )
            expect(unnamed.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({
                    summary: "chatbot[inst-2].reply_customer",
                    evidence: "handoff \u00b7 instance inst-2 (first)",
                }),
            )
        })

        it("lets neither the Office nor the evidence log block the command", async () => {
            const built = await build(mockEntityManager({ query: [[FIND_SUBJECT_LABEL, []]] }))
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
