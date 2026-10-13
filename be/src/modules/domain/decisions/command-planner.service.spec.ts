import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CommandPlannerService } from "./command-planner.service"
import type { CommandRefusal, ModuleEntry, SendCommandInput, WorkContext } from "./decisions.contracts"
import { DecisionsError, DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import { ModuleCatalogService } from "./module-catalog.service"
import { OfficeLinesService } from "@modules/domain/messages"
import {
    CHAIN_REPEATS_COMMAND,
    FIND_CHAIN_TOP,
    FIND_PARENT_POSITION,
    FIND_SENDER_AGENT,
} from "./persistence/command-bus.sql"
import type { CommandPlan, PlannedCommand } from "./work-engine.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
const AGENT_ID = "2f5f2c0e-1a2b-4c3d-8e9f-0a1b2c3d4e5f"

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

describe("CommandPlannerService", () => {
    describe("refusals", () => {
        const expectRefused = (
            built: Awaited<ReturnType<typeof build>>,
            plan: CommandPlan,
            refused: CommandRefusal,
            detail: string,
        ): void => {
            expect(plan).toEqual({ ok: false, refused, detail })
            expect(built.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ kind: "command.refused", actor: "NIVO", evidence: detail }),
            )
        }

        it("refuses an unknown module", async () => {
            const built = await build()
            const plan = await built.service.plan(ctx, inputOf({ to: "mystery" }))
            expectRefused(built, plan, "unknown_module", "no agent mystery")
            expect(built.log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ summary: "owner -> mystery.classify_lead: unknown_module" }),
            )
        })

        it("refuses a command the module does not accept", async () => {
            const built = await build()
            const plan = await built.service.plan(ctx, inputOf({ command: "dance" }))
            expectRefused(built, plan, "unknown_command", "sales does not accept dance")
        })

        it("refuses a sender that is nobody", async () => {
            const built = await build()
            const plan = await built.service.plan(ctx, inputOf({ from: "stranger" }))
            expectRefused(built, plan, "unknown_sender", "no sender stranger")
        })

        it("refuses an agent id that names no agent of the workspace", async () => {
            const built = await build([[FIND_SENDER_AGENT, []]])
            const plan = await built.service.plan(ctx, inputOf({ from: AGENT_ID }))
            expectRefused(built, plan, "unknown_sender", `no sender ${AGENT_ID}`)
        })

        it("lists the payload keys that are missing", async () => {
            const built = await build()
            const plan = await built.service.plan(ctx, inputOf({ payload: { subject_id: "lead-1" } }))
            expect(plan).toEqual({
                ok: false,
                refused: "missing_fields",
                detail: "sales.classify_lead needs lead_id",
                missing: ["lead_id"],
            })
            expect(built.log).toHaveBeenCalledTimes(1)
        })

        it("refuses a subject type that is not a kind of record", async () => {
            const built = await build()
            const plan = await built.service.plan(
                ctx,
                inputOf({ payload: { lead_id: "lead-1", subject_type: "planet" } }),
            )
            expect(plan).toEqual({
                ok: false,
                refused: "missing_fields",
                detail: "planet is not a kind of record",
                missing: ["subject_type"],
            })
        })

        it("refuses a chain that is too deep", async () => {
            const built = await build([[FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: "chain-1", depth: 6 }]]])
            const plan = await built.service.plan(ctx, inputOf({ parentId: "parent-1" }))
            expectRefused(built, plan, "too_deep", "depth 7 is deeper than the chain allows")
        })

        it("refuses the same command on the same subject twice in one chain", async () => {
            const built = await build([
                [FIND_CHAIN_TOP, [{ depth: 1 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: true }]],
            ])
            const plan = await built.service.plan(ctx, inputOf({ chainId: "chain-1" }))
            expectRefused(built, plan, "cycle", "classify_lead on lead already ran in chain chain-1")
            expect(built.em.query).toHaveBeenCalledWith(CHAIN_REPEATS_COMMAND, [
                "ws-1",
                "chain-1",
                "classify_lead",
                "lead",
                "cmd:classify_lead:lead:lead-1",
                "lead-1",
            ])
        })

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

            const plan = planned(
                await built.service.plan(
                    ctx,
                    inputOf({
                        payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1", note: "vip" },
                        seed: { summary: "S", fields: { a: 1 } },
                        inboundEventId: "in-1",
                        origin: "simulated",
                        queue: true,
                        preset: true,
                        noChain: true,
                        forceAsk: "unclear_outcome",
                        dedupeKey: "key-1",
                    }),
                ),
            )

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
                    origin: "simulated",
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

        it("defaults the dedupe key, the origin and the seed", async () => {
            const built = await build()

            const plan = planned(await built.service.plan(ctx, inputOf()))

            expect(plan.spec.dedupeKey).toBe("cmd:classify_lead:lead:lead-1")
            expect(plan.spec.origin).toBe("live")
            expect(plan.spec.seed).toEqual({ fields: {} })
        })

        it("is about the receiver's own kind of record when the payload names none", async () => {
            const built = await build()

            const plan = planned(await built.service.plan(ctx, inputOf({ payload: { lead_id: "lead-1" } })))

            expect(plan.spec.subject_type).toBe("lead")
            expect(plan.spec.subject_id).toBeNull()
            expect(plan.spec.dedupeKey).toBe("cmd:classify_lead:lead:none")
        })
    })

    describe("the place in the chain", () => {
        it("follows its parent: one deeper, in the parent's chain", async () => {
            const built = await build([
                [FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: "chain-1", depth: 2 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
            ])

            const plan = planned(await built.service.plan(ctx, inputOf({ parentId: "parent-1" })))

            expect(plan.depth).toBe(3)
            expect(plan.spec.chainId).toBe("chain-1")
            expect(plan.spec.parent_id).toBe("parent-1")
        })

        it("keeps the chain it names and falls back to the parent's id when the parent has no chain", async () => {
            const named = await build([
                [FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: "chain-9", depth: 0 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
            ])
            const loose = await build([
                [FIND_PARENT_POSITION, [{ id: "parent-1", chain_id: null, depth: 0 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
            ])
            const first = planned(await named.service.plan(ctx, inputOf({ parentId: "parent-1", chainId: "chain-1" })))
            const second = planned(await loose.service.plan(ctx, inputOf({ parentId: "parent-1" })))

            expect(first.spec.chainId).toBe("chain-1")
            expect(second.spec.chainId).toBe("parent-1")
        })

        it("is a root of the chain it names when the parent cannot be found", async () => {
            const built = await build([
                [FIND_PARENT_POSITION, []],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
            ])

            const plan = planned(await built.service.plan(ctx, inputOf({ parentId: "gone", chainId: "chain-1" })))

            expect(plan.depth).toBe(0)
            expect(plan.spec.chainId).toBe("chain-1")
        })

        it("follows the deepest item of the chain it names, or sits at depth 1 in an empty one", async () => {
            const deep = await build([
                [FIND_CHAIN_TOP, [{ depth: 3 }]],
                [CHAIN_REPEATS_COMMAND, [{ repeats: false }]],
            ])
            const empty = await build([
                [FIND_CHAIN_TOP, []],
                [CHAIN_REPEATS_COMMAND, []],
            ])

            const first = planned(await deep.service.plan(ctx, inputOf({ chainId: "chain-1" })))
            const second = planned(await empty.service.plan(ctx, inputOf({ chainId: "chain-1" })))

            expect([first.depth, second.depth]).toEqual([4, 1])
        })
    })
})
