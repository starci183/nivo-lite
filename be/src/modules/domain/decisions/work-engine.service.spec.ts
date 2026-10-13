import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type * as Work from "./decisions.contracts"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkChainService } from "./work-chain.service"
import type { OutboundAccess } from "./work-engine.contracts"
import type { InboundWorkSource } from "./inbound-work.contracts"
import { OUTBOUND_ACCESS_GATE } from "./work-engine.decorators"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import type { OutboundAccessGate } from "./work-engine.port"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import type { WorkPerformerRegistry } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"

const ctx: Work.WorkContext = { workspaceId: "ws-1", actor: "An", locale: "en" }
const quote: Work.Proposal = { summary: "Quote", fields: { items: "tea" }, amount_vnd: 100 }
const existingItem = expect.objectContaining({ id: "item-1" })
const doneItem = expect.objectContaining({ status: "done" })
const waitingItem = expect.objectContaining({ id: "item-1", reason: "over_authority" })
const humanDone = expect.objectContaining({ path: "human" })
const autoPlan = { path: "auto", by: { name: "NIVO", kind: "policy" }, outcome: "auto_done" }
const authorityAsk = expect.objectContaining({
    verdict: expect.objectContaining({ verdict: "ask", reason: "over_authority" }),
})
const anyValue = expect.anything()
const editedDraft = expect.objectContaining({ draft: "x" })
const itemOf = builder<Work.WorkItem>({
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
    proposal: quote,
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
const ruleOf = builder<Work.AuthorityRule>({
    id: "rule-1",
    department: "sales",
    action: "send_quote",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
})
const actionEntry = builder<Work.ActionEntry>({
    action: "send_quote",
    moduleKey: "sales",
    maxMode: null,
    next: [],
    label: { vi: "Gui bao gia", en: "Send quote" },
})
const specOf = builder<Work.WorkSpec>({
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    dedupeKey: "send_quote:lead-1",
    origin: "live",
})
const performedOf = builder<Work.Performed>({ summary: "Sent the quote", evidence: "captured" })
interface Options {
    readonly performer?: Work.WorkPerformer | null
    readonly rule?: Work.OptionalAuthorityRule
    readonly access?: OutboundAccess
    readonly action?: Work.ActionEntry | null
    readonly created?: boolean
    readonly items?: Partial<WorkItemsService>
}
const performerOf = (overrides: Partial<Work.WorkPerformer> = {}): Work.WorkPerformer => ({
    prepare: jest.fn((_ctx: Work.WorkContext, item: Work.WorkItem) => Promise.resolve({ proposal: item.proposal })),
    perform: jest.fn().mockResolvedValue(performedOf()),
    ...overrides,
})
const build = async (options: Options = {}) => {
    const performer = options.performer === undefined ? performerOf() : options.performer
    const insert = jest.fn((_ctx: Work.WorkContext, spec: Work.WorkSpec) =>
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
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}(${Object.values(params ?? {}).join(",")})`)
    const modules = mock<ModuleCatalogService>()
    modules.actionOf.mockResolvedValue(options.action === undefined ? actionEntry() : options.action)
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
            { provide: MESSAGE_CATALOG, useValue: catalog },
            {
                provide: WORK_PERFORMER_REGISTRY,
                useValue: mock<WorkPerformerRegistry>({ performerOf: jest.fn().mockReturnValue(performer) }),
            },
            { provide: OUTBOUND_ACCESS_GATE, useValue: mock<OutboundAccessGate>({ accessOf }) },
            { provide: WorkItemsService, useValue: items },
            { provide: ModuleCatalogService, useValue: modules },
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

const run = async (options: Options = {}, overrides: Partial<Work.WorkSpec> = {}) => {
    const built = await build(options)
    return { built, item: await built.service.runWork(ctx, specOf(overrides)) }
}

describe("WorkEngineService", () => {
    describe("runWork", () => {
        it("answers the existing item when the dedupe key was used", async () => {
            const { built, item } = await run({ created: false })
            expect(item.id).toBe("item-1")
            expect(built.items.claim).not.toHaveBeenCalled()
        })
        it("only inserts a queued item", async () => {
            const { built, item } = await run({}, { queue: true })
            expect(item.status).toBe("queued")
            expect(built.items.claim).not.toHaveBeenCalled()
        })
        it("answers the item when another worker already holds it", async () => {
            const { built, item } = await run({ items: { claim: jest.fn().mockResolvedValue(null) } })
            expect(item.status).toBe("queued")
            expect(built.items.claim).toHaveBeenCalledWith("ws-1", "item-1")
            expect(built.performer?.prepare).not.toHaveBeenCalled()
        })

        it("prepares, passes the gate, performs and logs an automatic item, then continues the chain", async () => {
            const prepared: Work.Prepared = {
                proposal: { summary: "Work.Prepared", fields: { items: "tea" } },
                patch: { lead_id: "lead-2", subject_type: "order", subject_id: "order-1" },
            }
            const performer = performerOf({ prepare: jest.fn().mockResolvedValue(prepared) })
            const saved = itemOf({ lead_id: "lead-2", proposal: prepared.proposal })
            const { built, item } = await run({
                performer,
                items: { savePrepared: jest.fn().mockResolvedValue(saved) },
            })
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
                doneItem,
                prepared.proposal,
                autoPlan,
                performedOf(),
            )
            expect(built.continueChain).toHaveBeenCalledWith(ctx, doneItem)
            expect(built.ask).not.toHaveBeenCalled()
        })

        it("keeps the stored address when the performer corrects none", async () => {
            const { built } = await run({})
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
            const { built } = await run({ performer })
            expect(built.items.markDone).toHaveBeenCalledWith(
                "item-1",
                expect.objectContaining({ result: { summary: "Sent the quote", href: "/quotes/1" }, leadId: "lead-9" }),
            )
        })

        it("skips the prepare step of a preset item and the chain of a no-chain item", async () => {
            const { built } = await run({}, { preset: true, noChain: true })
            expect(built.performer?.prepare).not.toHaveBeenCalled()
            expect(built.items.savePrepared).not.toHaveBeenCalled()
            expect(built.finished).toHaveBeenCalledTimes(1)
            expect(built.continueChain).not.toHaveBeenCalled()
        })

        it.each([
            { label: "with a label", action: actionEntry(), result: { summary: "engine.recordOnly(Send quote)" } },
            { label: "without a label", action: null, result: { summary: "engine.recordOnly(send_quote)" } },
        ])("records an action without a performer $label", async ({ action, result }) => {
            const { built } = await run({ performer: null, action })
            expect(built.items.markDone).toHaveBeenCalledWith(
                "item-1",
                expect.objectContaining({ result, evidence: "pending", leadId: "lead-1" }),
            )
        })
        it("asks a person when the owner has granted no rule", async () => {
            const { built, item } = await run({ rule: null })
            expect(item.status).toBe("waiting_decision")
            expect(built.ask).toHaveBeenCalledWith(ctx, existingItem, quote, {
                verdict: expect.objectContaining({ verdict: "ask", reason: "not_allowed" }),
                rule: null,
            })
            expect(built.finished).not.toHaveBeenCalled()
        })
        it("asks a person when the item was forced to ask", async () => {
            const { built } = await run({}, { preset: true, forceAsk: "unclear_outcome" })
            expect(built.ask).toHaveBeenCalledWith(ctx, anyValue, anyValue, {
                verdict: { verdict: "ask", reason: "unclear_outcome", reasons: ["unclear_outcome"], missing: [] },
                rule: ruleOf(),
            })
        })

        it.each(["auto", "ask", "read"] as const)("honors the %s outbound grant", async (access) => {
            const { built } = await run({ access }, { preset: true })
            if (access === "auto") {
                expect(built.accessOf).toHaveBeenCalledWith(ctx, existingItem, anyValue)
                expect(built.finished).toHaveBeenCalledTimes(1)
            } else {
                expect(built.ask).toHaveBeenCalledWith(ctx, anyValue, anyValue, authorityAsk)
            }
        })
        it("does not look at the access of an action that sends no message", async () => {
            const { built } = await run(
                {
                    action: actionEntry({ action: "classify_lead" }),
                    items: { claim: jest.fn().mockResolvedValue(itemOf({ action: "classify_lead" })) },
                },
                { action: "classify_lead", preset: true },
            )
            expect(built.accessOf).not.toHaveBeenCalled()
        })

        it.each([
            { cause: new RangeError("model down"), message: "model down" },
            { cause: "x".repeat(600), message: "x".repeat(500) },
        ])("fails the item and records the normalized failure $message", async ({ cause, message }) => {
            const performer = performerOf({ prepare: jest.fn().mockRejectedValue(cause) })
            const { built, item } = await run({ performer })
            expect(item.status).toBe("failed")
            expect(built.items.markFailed).toHaveBeenCalledWith("item-1", message)
            expect(built.failed).toHaveBeenCalledWith(ctx, existingItem, message)
        })

        it("still answers a failed item when the failure cannot be saved", async () => {
            const performer = performerOf({ perform: jest.fn().mockRejectedValue(new RangeError("send failed")) })
            const { built, item } = await run({
                performer,
                items: { markFailed: jest.fn().mockRejectedValue(new RangeError("db down")) },
            })
            expect(item).toEqual(expect.objectContaining({ status: "failed", error: "send failed" }))
            expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.MarkFailedFailed, expect.any(RangeError), {
                workItemId: "item-1",
            })
        })
    })

    it("hands the finished item to the chain", async () => {
        const built = await build()
        await built.service.continueChain(ctx, itemOf())
        expect(built.continueChain).toHaveBeenCalledWith(ctx, itemOf())
    })

    describe("runQueued", () => {
        it.each([
            { limit: 0, queued: null, count: 0, reads: [] },
            { limit: 3, queued: null, count: 0, reads: [["ws-1"]] },
            { limit: 2, queued: itemOf(), count: 2, reads: [["ws-1"], ["ws-1"]] },
        ])("processes $count items with a limit of $limit", async ({ limit, queued, count, reads }) => {
            const built = await build({ items: { nextQueued: jest.fn().mockResolvedValue(queued) } })
            expect(await built.service.runQueued(ctx, limit)).toBe(count)
            expect(built.items.nextQueued.mock.calls).toEqual(reads)
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
    })

    describe("resumeWork", () => {
        const owner = { name: "Lan", kind: "owner" } as const

        it("refuses a decision on an item that no longer waits", async () => {
            const built = await build({ items: { reopen: jest.fn().mockResolvedValue(null) } })
            await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toThrow(
                DecisionsErrorCode.NotWaiting,
            )
            expect(built.items.reopen).toHaveBeenCalledWith("ws-1", "item-1")
        })

        it("stops the work with the action's undo and tells the people", async () => {
            const onReject = jest.fn().mockResolvedValue(undefined)
            const built = await build({ performer: performerOf({ onReject }) })
            const item = await built.service.resumeWork(ctx, "item-1", "rejected", { draft: "x" }, owner, "no")
            expect(item.status).toBe("rejected")
            expect(onReject).toHaveBeenCalledWith(ctx, existingItem, anyValue, owner)
            expect(built.items.markRejected).toHaveBeenCalledWith(
                "item-1",
                { ...quote, draft: "x" },
                { summary: "engine.rejectedResult()" },
            )
            expect(built.rejected).toHaveBeenCalledWith(ctx, existingItem, editedDraft, owner, "no")
        })
        it("needs no undo from a performer without one, or from an action without a performer", async () => {
            const plain = await build()
            const none = await build({ performer: null })
            await plain.service.resumeWork(ctx, "item-1", "rejected", {}, owner)
            await none.service.resumeWork(ctx, "item-1", "rejected", {}, owner)
            expect(plain.rejected).toHaveBeenCalledWith(ctx, anyValue, anyValue, owner, null)
            expect(none.rejected).toHaveBeenCalledTimes(1)
        })

        it.each([
            ["rejected", "onReject", "undo failed"],
            ["approved", "perform", "send failed"],
        ] as const)("fails and rethrows a %s decision", async (decision, method, message) => {
            const performer = performerOf({ [method]: jest.fn().mockRejectedValue(new RangeError(message)) })
            const built = await build({ performer, rule: decision === "approved" ? ruleOf({ mode: "ask" }) : ruleOf() })
            await expect(built.service.resumeWork(ctx, "item-1", decision, {}, owner)).rejects.toThrow(message)
            expect(built.failed).toHaveBeenCalledWith(ctx, existingItem, message)
        })

        const candidates = [
            { id: "inv-1", label: "One", amount_vnd: 1 },
            { id: "inv-2", label: "Two", amount_vnd: 2 },
        ]
        const proposal: Work.Proposal = { summary: "Pay", fields: {}, candidates }
        it.each([
            ["unchanged", {}, null, "approved", expect.objectContaining({ outcome: "clear" })],
            ["edited", { amount_vnd: 90 }, "cheaper", "edited", expect.objectContaining({ amount_vnd: 90 })],
        ] as const)("logs an %s approval", async (_, edits, note, outcome, proposal) => {
            const built = await build({ rule: ruleOf({ mode: "ask" }) })
            const item = await built.service.resumeWork(ctx, "item-1", "approved", edits, owner, note)
            expect(item.status).toBe("done")
            expect(built.items.markDone).toHaveBeenCalledWith("item-1", humanDone)
            const plan = { path: "human", by: owner, outcome, note, before: quote }
            expect(built.finished).toHaveBeenCalledWith(ctx, waitingItem, doneItem, proposal, plan, performedOf())
            expect(built.continueChain).toHaveBeenCalledTimes(1)
        })

        it("sends the item back to waiting and names the fields that are still missing", async () => {
            const built = await build({ rule: ruleOf({ required_fields: ["need"] }) })
            await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toMatchObject({
                code: DecisionsErrorCode.StillMissing,
                params: { fields: "Need" },
            })
            expect(built.items.markStillWaiting).toHaveBeenCalledWith("item-1", {
                proposal: quote,
                missing: ["need"],
                reason: "missing_data",
                reasons: ["missing_data"],
            })
            expect(built.finished).not.toHaveBeenCalled()
        })

        it("asks the person to choose among several candidates", async () => {
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
            const built = await build({
                rule: ruleOf({ mode: "ask" }),
                items: { reopen: jest.fn().mockResolvedValue(itemOf({ proposal })) },
            })
            await built.service.resumeWork(ctx, "item-1", "approved", { candidateId: "inv-2" }, owner)
            expect(built.finished).toHaveBeenCalledWith(
                ctx,
                anyValue,
                anyValue,
                expect.objectContaining({ candidates: [candidates[1]] }),
                anyValue,
                anyValue,
            )
        })
    })

    describe("inputs to work", () => {
        const event: InboundWorkSource = { id: "event-1", origin: "simulated" }

        it("starts the department's work for an inbound event", async () => {
            const built = await build({ created: false })
            const seed: Partial<Work.Proposal> = { summary: "Hi" }
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
