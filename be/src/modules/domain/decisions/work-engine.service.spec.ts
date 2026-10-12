import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type {
    ActionEntry,
    AuthorityRule,
    OptionalAuthorityRule,
    Performed,
    Prepared,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkSpec,
} from "./decisions.contracts"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkChainService } from "./work-chain.service"
import type { OutboundAccess } from "./work-engine.contracts"
import { OUTBOUND_ACCESS_GATE } from "./work-engine.decorators"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import type { OutboundAccessGate } from "./work-engine.port"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
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
    proposal: { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: "2026-10-12T09:00:00.000Z",
    updated_at: "2026-10-12T09:00:00.000Z",
    completed_at: null,
    installation_id: "inst-1",
})

const ruleOf = builder<AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "send_quote",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})

const actionEntry = builder<ActionEntry>({
    action: "send_quote",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Gui bao gia", en: "Send quote" },
})

const specOf = builder<WorkSpec>({
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    dedupeKey: "send_quote:lead-1",
    origin: "live",
})

const performedOf = builder<Performed>({ summary: "Sent the quote", evidence: "captured" })

interface Options {
    readonly performer?: WorkPerformer | null
    readonly rule?: OptionalAuthorityRule
    readonly access?: OutboundAccess
    readonly action?: ActionEntry | null
    readonly created?: boolean
    readonly items?: Partial<WorkItemsService>
}

const performerOf = (overrides: Partial<WorkPerformer> = {}): WorkPerformer => ({
    prepare: jest.fn((_ctx: WorkContext, item: WorkItem): Promise<Prepared> =>
        Promise.resolve({ proposal: item.proposal }),
    ),
    perform: jest.fn().mockResolvedValue(performedOf()),
    ...overrides,
})

const build = async (options: Options = {}) => {
    const performer = options.performer === undefined ? performerOf() : options.performer
    const insert = jest.fn((_ctx: WorkContext, spec: WorkSpec) =>
        Promise.resolve({ item: itemOf({ action: spec.action }), created: options.created ?? true }),
    )
    const ask = jest.fn().mockResolvedValue(itemOf({ status: "waiting_decision" }))
    const continueChain = jest.fn().mockResolvedValue(undefined)
    const finished = jest.fn().mockResolvedValue(undefined)
    const rejected = jest.fn().mockResolvedValue(undefined)
    const failed = jest.fn().mockResolvedValue(undefined)
    const accessOf = jest.fn().mockResolvedValue(options.access ?? "auto")
    const ruleFor = jest.fn().mockResolvedValue(options.rule === undefined ? ruleOf() : options.rule)
    const error = jest.fn()
    const items = mock<WorkItemsService>({
        claim: jest.fn().mockResolvedValue(itemOf()),
        nextQueued: jest.fn().mockResolvedValue(null),
        reopen: jest.fn().mockResolvedValue(itemOf({ status: "queued", reason: "over_authority" })),
        savePrepared: jest.fn().mockResolvedValue(itemOf()),
        markDone: jest.fn().mockResolvedValue(itemOf({ status: "done" })),
        markFailed: jest.fn().mockResolvedValue(itemOf({ status: "failed" })),
        markRejected: jest.fn().mockResolvedValue(itemOf({ status: "rejected" })),
        markStillWaiting: jest.fn().mockResolvedValue(undefined),
        ...options.items,
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkEngineService,
            { provide: LOGGER, useValue: mock<Logger>({ error }) },
            {
                provide: MESSAGE_CATALOG,
                useValue: mock<MessageCatalog>({
                    get: jest.fn(
                        (key: string, params: Readonly<Record<string, string | number>>) =>
                            `${key}(${Object.values(params).join(",")})`,
                    ),
                }),
            },
            {
                provide: WORK_PERFORMER_REGISTRY,
                useValue: mock<WorkPerformerRegistry>({ performerOf: jest.fn().mockReturnValue(performer) }),
            },
            { provide: OUTBOUND_ACCESS_GATE, useValue: mock<OutboundAccessGate>({ accessOf }) },
            { provide: WorkItemsService, useValue: items },
            {
                provide: ModuleCatalogService,
                useValue: mock<ModuleCatalogService>({
                    actionOf: jest
                        .fn()
                        .mockResolvedValue(options.action === undefined ? actionEntry() : options.action),
                }),
            },
            { provide: AuthorityRulesService, useValue: mock<AuthorityRulesService>({ ruleFor }) },
            { provide: WorkIntakeService, useValue: mock<WorkIntakeService>({ insert }) },
            { provide: WorkChainService, useValue: mock<WorkChainService>({ continueChain }) },
            {
                provide: WorkApprovalService,
                useValue: mock<WorkApprovalService>({ ask, fieldLabels: jest.fn().mockReturnValue("Need") }),
            },
            { provide: WorkRecorderService, useValue: mock<WorkRecorderService>({ finished, rejected, failed }) },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkEngineService),
        items,
        performer,
        insert,
        ask,
        continueChain,
        finished,
        rejected,
        failed,
        accessOf,
        ruleFor,
        error,
    }
}

describe("WorkEngineService", () => {
    describe("runWork", () => {
        it("answers the existing item when the dedupe key was used", async () => {
            const built = await build({ created: false })

            const item = await built.service.runWork(ctx, specOf())

            expect(item.id).toBe("item-1")
            expect(built.items.claim).not.toHaveBeenCalled()
        })

        it("only inserts a queued item", async () => {
            const built = await build()

            const item = await built.service.runWork(ctx, specOf({ queue: true }))

            expect(item.status).toBe("queued")
            expect(built.items.claim).not.toHaveBeenCalled()
        })

        it("answers the item when another worker already holds it", async () => {
            const built = await build({ items: { claim: jest.fn().mockResolvedValue(null) } })

            const item = await built.service.runWork(ctx, specOf())

            expect(item.status).toBe("queued")
            expect(built.items.claim).toHaveBeenCalledWith("ws-1", "item-1")
            expect(built.performer?.prepare).not.toHaveBeenCalled()
        })

        it("prepares, passes the gate, performs and logs an automatic item, then continues the chain", async () => {
            const prepared: Prepared = {
                proposal: { summary: "Prepared", fields: { items: "tea" } },
                patch: { lead_id: "lead-2", subject_type: "order", subject_id: "order-1" },
            }
            const performer = performerOf({ prepare: jest.fn().mockResolvedValue(prepared) })
            const saved = itemOf({ lead_id: "lead-2", proposal: prepared.proposal })
            const built = await build({ performer, items: { savePrepared: jest.fn().mockResolvedValue(saved) } })

            const item = await built.service.runWork(ctx, specOf())

            expect(item.status).toBe("done")
            expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", {
                proposal: prepared.proposal,
                subjectType: "order",
                subjectId: "order-1",
                leadId: "lead-2",
            })
            expect(built.ruleFor).toHaveBeenCalledWith(ctx, "send_quote", "inst-1")
            expect(built.items.markDone).toHaveBeenCalledWith("item-1", {
                path: "auto",
                proposal: prepared.proposal,
                result: { summary: "Sent the quote" },
                evidence: "captured",
                leadId: null,
            })
            expect(built.finished).toHaveBeenCalledWith(
                ctx,
                saved,
                expect.objectContaining({ status: "done" }),
                prepared.proposal,
                { path: "auto", by: { name: "NIVO", kind: "policy" }, outcome: "auto_done" },
                performedOf(),
            )
            expect(built.continueChain).toHaveBeenCalledWith(ctx, expect.objectContaining({ status: "done" }))
            expect(built.ask).not.toHaveBeenCalled()
        })

        it("keeps the stored address when the performer corrects none", async () => {
            const built = await build()

            await built.service.runWork(ctx, specOf())

            expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", {
                proposal: itemOf().proposal,
                subjectType: null,
                subjectId: null,
                leadId: null,
            })
        })

        it("records the href and the customer the performer found", async () => {
            const performer = performerOf({
                perform: jest.fn().mockResolvedValue(performedOf({ href: "/quotes/1", lead_id: "lead-9" })),
            })
            const built = await build({ performer })

            await built.service.runWork(ctx, specOf())

            expect(built.items.markDone).toHaveBeenCalledWith(
                "item-1",
                expect.objectContaining({ result: { summary: "Sent the quote", href: "/quotes/1" }, leadId: "lead-9" }),
            )
        })

        it("skips the prepare step of a preset item and the chain of a no-chain item", async () => {
            const built = await build()

            await built.service.runWork(ctx, specOf({ preset: true, noChain: true }))

            expect(built.performer?.prepare).not.toHaveBeenCalled()
            expect(built.items.savePrepared).not.toHaveBeenCalled()
            expect(built.finished).toHaveBeenCalledTimes(1)
            expect(built.continueChain).not.toHaveBeenCalled()
        })

        it("records the decision of an action without a performer", async () => {
            const built = await build({ performer: null })

            await built.service.runWork(ctx, specOf())

            expect(built.items.markDone).toHaveBeenCalledWith(
                "item-1",
                expect.objectContaining({
                    result: { summary: "engine.recordOnly(Send quote)" },
                    evidence: "pending",
                    leadId: "lead-1",
                }),
            )
        })

        it("names an action without a label by its key", async () => {
            const built = await build({ performer: null, action: null })

            await built.service.runWork(ctx, specOf())

            expect(built.items.markDone).toHaveBeenCalledWith(
                "item-1",
                expect.objectContaining({ result: { summary: "engine.recordOnly(send_quote)" } }),
            )
        })

        it("asks a person when the owner has granted no rule", async () => {
            const built = await build({ rule: null })

            const item = await built.service.runWork(ctx, specOf())

            expect(item.status).toBe("waiting_decision")
            expect(built.ask).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ id: "item-1" }),
                { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 },
                { verdict: expect.objectContaining({ verdict: "ask", reason: "not_allowed" }), rule: null },
            )
            expect(built.finished).not.toHaveBeenCalled()
        })

        it("asks a person when the item was forced to ask", async () => {
            const built = await build()

            await built.service.runWork(ctx, specOf({ preset: true, forceAsk: "unclear_outcome" }))

            expect(built.ask).toHaveBeenCalledWith(ctx, expect.anything(), expect.anything(), {
                verdict: { verdict: "ask", reason: "unclear_outcome", reasons: ["unclear_outcome"], missing: [] },
                rule: ruleOf(),
            })
        })

        describe("the agent access of the connection a message leaves through", () => {
            it("lets a message run alone when the grant is auto", async () => {
                const built = await build({ access: "auto" })

                await built.service.runWork(ctx, specOf({ preset: true }))

                expect(built.accessOf).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({ id: "item-1" }),
                    expect.anything(),
                )
                expect(built.finished).toHaveBeenCalledTimes(1)
            })

            it.each(["ask", "read"] as const)("holds a message for a person when the grant is %s", async (access) => {
                const built = await build({ access })

                await built.service.runWork(ctx, specOf({ preset: true }))

                expect(built.ask).toHaveBeenCalledWith(
                    ctx,
                    expect.anything(),
                    expect.anything(),
                    expect.objectContaining({
                        verdict: expect.objectContaining({ verdict: "ask", reason: "over_authority" }),
                    }),
                )
            })

            it("does not look at the access of an action that sends no message", async () => {
                const built = await build({
                    action: actionEntry({ action: "classify_lead" }),
                    items: { claim: jest.fn().mockResolvedValue(itemOf({ action: "classify_lead" })) },
                })

                await built.service.runWork(ctx, specOf({ action: "classify_lead", preset: true }))

                expect(built.accessOf).not.toHaveBeenCalled()
            })
        })

        describe("a failure", () => {
            it("fails the item, tells the people, and answers the failed item", async () => {
                const performer = performerOf({ prepare: jest.fn().mockRejectedValue(new RangeError("model down")) })
                const built = await build({ performer })

                const item = await built.service.runWork(ctx, specOf())

                expect(item.status).toBe("failed")
                expect(built.items.markFailed).toHaveBeenCalledWith("item-1", "model down")
                expect(built.failed).toHaveBeenCalledWith(ctx, expect.objectContaining({ id: "item-1" }), "model down")
            })

            it("cuts a long failure and writes a thrown text as it is", async () => {
                const performer = performerOf({ prepare: jest.fn().mockRejectedValue("x".repeat(600)) })
                const built = await build({ performer })

                await built.service.runWork(ctx, specOf())

                expect(built.items.markFailed).toHaveBeenCalledWith("item-1", "x".repeat(500))
            })

            it("still answers a failed item when the failure cannot be saved", async () => {
                const performer = performerOf({ perform: jest.fn().mockRejectedValue(new RangeError("send failed")) })
                const built = await build({
                    performer,
                    items: { markFailed: jest.fn().mockRejectedValue(new RangeError("db down")) },
                })

                const item = await built.service.runWork(ctx, specOf())

                expect(item).toEqual(expect.objectContaining({ status: "failed", error: "send failed" }))
                expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.MarkFailedFailed, expect.any(RangeError), {
                    workItemId: "item-1",
                })
            })
        })
    })

    describe("continueChain", () => {
        it("hands the finished item to the chain", async () => {
            const built = await build()

            await built.service.continueChain(ctx, itemOf())

            expect(built.continueChain).toHaveBeenCalledWith(ctx, itemOf())
        })
    })

    describe("runQueued", () => {
        it("processes nothing without a limit", async () => {
            const built = await build()

            expect(await built.service.runQueued(ctx, 0)).toBe(0)
            expect(built.items.nextQueued).not.toHaveBeenCalled()
        })

        it("stops when no queued item is free", async () => {
            const built = await build()

            expect(await built.service.runQueued(ctx, 3)).toBe(0)
            expect(built.items.nextQueued).toHaveBeenCalledWith("ws-1")
        })

        it("processes up to the limit, oldest first, and counts only what it took", async () => {
            const claim = jest
                .fn()
                .mockResolvedValueOnce(itemOf({ id: "a" }))
                .mockResolvedValueOnce(null)
            const nextQueued = jest
                .fn()
                .mockResolvedValueOnce(itemOf({ id: "a" }))
                .mockResolvedValueOnce(itemOf({ id: "b" }))
                .mockResolvedValueOnce(null)
            const built = await build({ items: { claim, nextQueued } })

            expect(await built.service.runQueued(ctx, 5)).toBe(1)
            expect(claim.mock.calls).toEqual([
                ["ws-1", "a"],
                ["ws-1", "b"],
            ])
            expect(built.finished).toHaveBeenCalledTimes(1)
        })

        it("stops at the limit", async () => {
            const built = await build({ items: { nextQueued: jest.fn().mockResolvedValue(itemOf()) } })

            expect(await built.service.runQueued(ctx, 2)).toBe(2)
        })
    })
})
