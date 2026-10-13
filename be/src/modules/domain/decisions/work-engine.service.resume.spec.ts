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
    InboundEventRecord,
    OptionalAuthorityRule,
    Performed,
    Prepared,
    Proposal,
    WorkContext,
    WorkItem,
    WorkPerformer,
    WorkSpec,
} from "./decisions.contracts"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkChainService } from "./work-chain.service"
import type { OutboundAccess } from "./work-engine.contracts"
import { OUTBOUND_ACCESS_GATE } from "./work-engine.decorators"
import type { OutboundAccessGate } from "./work-engine.port"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
const NOW = "2026-10-12T10:00:00.000Z"

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

describe("WorkEngineService resume", () => {
    describe("resumeWork", () => {
        const owner = { name: "Lan", kind: "owner" } as const

        it("refuses a decision on an item that no longer waits", async () => {
            const built = await build({ items: { reopen: jest.fn().mockResolvedValue(null) } })

            await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toThrow(
                DecisionsErrorCode.NotWaiting,
            )
            expect(built.items.reopen).toHaveBeenCalledWith("ws-1", "item-1")
        })

        describe("a rejection", () => {
            it("stops the work with the action's undo and tells the people", async () => {
                const onReject = jest.fn().mockResolvedValue(undefined)
                const built = await build({ performer: performerOf({ onReject }) })

                const item = await built.service.resumeWork(ctx, "item-1", "rejected", { draft: "x" }, owner, "no")

                expect(item.status).toBe("rejected")
                expect(onReject).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({ id: "item-1" }),
                    expect.anything(),
                    owner,
                )
                expect(built.items.markRejected).toHaveBeenCalledWith(
                    "item-1",
                    { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100, draft: "x" },
                    { summary: "engine.rejectedResult()" },
                )
                expect(built.rejected).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({ id: "item-1" }),
                    expect.objectContaining({ draft: "x" }),
                    owner,
                    "no",
                )
            })

            it("needs no undo from a performer without one, or from an action without a performer", async () => {
                const plain = await build()
                const none = await build({ performer: null })

                await plain.service.resumeWork(ctx, "item-1", "rejected", {}, owner)
                await none.service.resumeWork(ctx, "item-1", "rejected", {}, owner)

                expect(plain.rejected).toHaveBeenCalledWith(ctx, expect.anything(), expect.anything(), owner, null)
                expect(none.rejected).toHaveBeenCalledTimes(1)
            })

            it("fails the item and rethrows when the undo fails", async () => {
                const onReject = jest.fn().mockRejectedValue(new RangeError("undo failed"))
                const built = await build({ performer: performerOf({ onReject }) })

                await expect(built.service.resumeWork(ctx, "item-1", "rejected", {}, owner)).rejects.toThrow(
                    "undo failed",
                )
                expect(built.failed).toHaveBeenCalledWith(ctx, expect.objectContaining({ id: "item-1" }), "undo failed")
            })
        })

        describe("an approval", () => {
            it("performs once the gate allows it for this item, logs the person's decision and continues the chain", async () => {
                const built = await build({ rule: ruleOf({ mode: "ask" }) })

                const item = await built.service.resumeWork(ctx, "item-1", "approved", {}, owner)

                expect(item.status).toBe("done")
                expect(built.items.markDone).toHaveBeenCalledWith("item-1", expect.objectContaining({ path: "human" }))
                expect(built.finished).toHaveBeenCalledWith(
                    ctx,
                    expect.objectContaining({ id: "item-1", reason: "over_authority" }),
                    expect.objectContaining({ status: "done" }),
                    expect.objectContaining({ outcome: "clear" }),
                    {
                        path: "human",
                        by: owner,
                        outcome: "approved",
                        note: null,
                        before: { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 },
                    },
                    performedOf(),
                )
                expect(built.continueChain).toHaveBeenCalledTimes(1)
            })

            it("logs the outcome edited with the note when the person changed something", async () => {
                const built = await build({ rule: ruleOf({ mode: "ask" }) })

                await built.service.resumeWork(ctx, "item-1", "approved", { amount_vnd: 90 }, owner, "cheaper")

                expect(built.finished).toHaveBeenCalledWith(
                    ctx,
                    expect.anything(),
                    expect.anything(),
                    expect.objectContaining({ amount_vnd: 90 }),
                    expect.objectContaining({ outcome: "edited", note: "cheaper" }),
                    expect.anything(),
                )
            })

            it("sends the item back to waiting and names the fields that are still missing", async () => {
                const built = await build({ rule: ruleOf({ required_fields: ["need"] }) })

                await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toMatchObject({
                    code: DecisionsErrorCode.StillMissing,
                    params: { fields: "Need" },
                })
                expect(built.items.markStillWaiting).toHaveBeenCalledWith("item-1", {
                    proposal: { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 },
                    missing: ["need"],
                    reason: "missing_data",
                    reasons: ["missing_data"],
                })
                expect(built.finished).not.toHaveBeenCalled()
            })

            it("asks the person to choose among several candidates", async () => {
                const candidates = [
                    { id: "inv-1", label: "One", amount_vnd: 1 },
                    { id: "inv-2", label: "Two", amount_vnd: 2 },
                ]
                const proposal: Proposal = { summary: "Pay", fields: {}, candidates }
                const built = await build({
                    items: { reopen: jest.fn().mockResolvedValue(itemOf({ proposal, reason: "unclear_outcome" })) },
                })

                await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toMatchObject({
                    code: DecisionsErrorCode.ChooseCandidate,
                })
                expect(built.items.markStillWaiting).toHaveBeenCalledWith(
                    "item-1",
                    expect.objectContaining({ proposal, reason: "unclear_outcome" }),
                )
            })

            it("accepts the chosen candidate", async () => {
                const candidates = [
                    { id: "inv-1", label: "One", amount_vnd: 1 },
                    { id: "inv-2", label: "Two", amount_vnd: 2 },
                ]
                const proposal: Proposal = { summary: "Pay", fields: {}, candidates }
                const built = await build({
                    rule: ruleOf({ mode: "ask" }),
                    items: { reopen: jest.fn().mockResolvedValue(itemOf({ proposal })) },
                })

                await built.service.resumeWork(ctx, "item-1", "approved", { candidateId: "inv-2" }, owner)

                expect(built.finished).toHaveBeenCalledWith(
                    ctx,
                    expect.anything(),
                    expect.anything(),
                    expect.objectContaining({ candidates: [candidates[1]] }),
                    expect.anything(),
                    expect.anything(),
                )
            })

            it("fails the item and rethrows when the work fails", async () => {
                const performer = performerOf({ perform: jest.fn().mockRejectedValue(new RangeError("send failed")) })
                const built = await build({ performer, rule: ruleOf({ mode: "ask" }) })

                await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toThrow(
                    "send failed",
                )
                expect(built.failed).toHaveBeenCalledWith(ctx, expect.objectContaining({ id: "item-1" }), "send failed")
            })
        })
    })

    describe("inputs to work", () => {
        const event: InboundEventRecord = {
            id: "event-1",
            workspace_id: "ws-1",
            channel: "website",
            kind: "order",
            origin: "simulated",
            sender_name: null,
            sender_contact: null,
            body: "",
            amount_vnd: null,
            external_ref: null,
            dedupe_key: "k",
            duplicate_count: 0,
            last_duplicate_at: null,
            lead_id: null,
            status: "received",
            created_at: NOW,
            event_id: null,
        }

        it("starts the department's work for an inbound event", async () => {
            const built = await build({ created: false })
            const seed: Partial<Proposal> = { summary: "Hi" }

            await built.service.startInboundWork(ctx, event, "reply_customer", seed, "lead-1")

            expect(built.insert).toHaveBeenCalledWith(ctx, {
                action: "reply_customer",
                subject_type: "inbound",
                subject_id: "event-1",
                inbound_event_id: "event-1",
                lead_id: "lead-1",
                origin: "simulated",
                dedupeKey: "reply_customer:inbound:event-1",
                seed,
            })
        })

        it("starts the confirmation of an order", async () => {
            const built = await build({ created: false })

            await built.service.startOrderWork(ctx, event, { items: "tea", amount_vnd: 500, lead_id: "lead-2" })
            await built.service.startOrderWork(ctx, event, { items: "tea", amount_vnd: null })

            expect(built.insert.mock.calls.map(([, spec]) => [spec.action, spec.lead_id, spec.seed])).toEqual([
                ["confirm_order", "lead-2", { amount_vnd: 500, fields: { items: "tea", amount_vnd: 500 } }],
                ["confirm_order", null, { amount_vnd: null, fields: { items: "tea", amount_vnd: null } }],
            ])
        })
    })
})
