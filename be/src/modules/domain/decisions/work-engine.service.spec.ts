import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { Logger } from "@modules/platform/logging"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { WorkPerformerRegistry } from "./work-performer.port"
import type { OutboundAccessGate } from "./work-engine.port"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import type * as Work from "./decisions.contracts"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkChainService } from "./work-chain.service"
import { OUTBOUND_ACCESS_GATE } from "./work-engine.decorators"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import type { InboundWorkSource } from "./inbound-work.contracts"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import {
    ctx,
    quote,
    itemOf,
    ruleOf,
    actionEntry,
    specOf,
    performedOf,
    messageProposalOf,
    approvalMessageOf,
    queuedRuns,
    performerFailures,
    decisionFailures,
    approvalCases,
    idleRuns,
    preparedOrderOf,
    preparedAddress,
    replySeed,
    inboundReply,
    orderSeeds,
    recordOnlyCases,
    inboundBatches,
    candidates,
    owner,
} from "@tests/fixtures/builders/work-engine.builder"

import type { WorkEngineFixtureOptions } from "@tests/fixtures/builders/work-engine.builder"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const quoteResult = { summary: "Sent the quote" }
const autoResult = { path: "auto", result: quoteResult, evidence: "captured", leadId: null }
const blankPatch = { proposal: quote, subjectType: null, subjectId: null, leadId: null }
const existingItem = objectLike({ id: "item-1" })
const doneItem = objectLike({ status: "done" })
const waitingItem = objectLike({ id: "item-1", reason: "over_authority" })
const humanDone = objectLike({ path: "human" })
const autoPlan = { path: "auto", by: { name: "NIVO", kind: "policy" }, outcome: "auto_done" }
const authorityAsk = objectLike({
    verdict: objectLike({ verdict: "ask", reason: "over_authority" }),
})
const anyValue: unknown = expect.anything()
const editedDraft = objectLike({ draft: "x" })

const resolved = <T>(value: T) => jest.fn().mockResolvedValue(value)
const performerOf = (overrides: Partial<Work.WorkPerformer> = {}): Work.WorkPerformer => {
    const performer = mock<Work.WorkPerformer>({
        prepare: jest.fn((_ctx: Work.WorkContext, item: Work.WorkItem) => Promise.resolve({ proposal: item.proposal })),
        perform: resolved(performedOf()),
        ...overrides,
    })
    return performer
}
const build = async (options: WorkEngineFixtureOptions = {}) => {
    const performer = options.performer === undefined ? performerOf() : options.performer
    const logger = mock<Logger>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}(${Object.values(params ?? {}).join(",")})`)
    const modules = mock<ModuleCatalogService>()
    modules.actionOf.mockResolvedValue(options.action === undefined ? actionEntry() : options.action)
    const items = mock<WorkItemsService>({
        claim: resolved(itemOf()),
        nextQueued: resolved(null),
        nextInboundQueued: resolved(null),
        reopen: resolved(itemOf({ status: "queued", reason: "over_authority" })),
        savePrepared: resolved(itemOf()),
        markDone: resolved(itemOf({ status: "done" })),
        markFailed: resolved(itemOf({ status: "failed" })),
        markRejected: resolved(itemOf({ status: "rejected" })),
        ...options.items,
    })
    const registry = mock<WorkPerformerRegistry>({ performerOf: jest.fn().mockReturnValue(performer) })
    const access = mock<OutboundAccessGate>({ accessOf: resolved(options.access ?? "auto") })
    const rules = mock<AuthorityRulesService>({
        ruleFor: resolved(options.rule === undefined ? ruleOf() : options.rule),
    })
    const intake = mock<WorkIntakeService>({
        insert: jest.fn((_ctx: Work.WorkContext, spec: Work.WorkSpec) =>
            Promise.resolve({ item: itemOf({ action: spec.action }), created: options.created ?? true }),
        ),
    })
    const chain = mock<WorkChainService>({ continueChain: resolved(undefined) })
    const approval = mock<WorkApprovalService>({
        ask: resolved(itemOf({ status: "waiting_decision" })),
        fieldLabels: jest.fn().mockReturnValue("Need"),
    })
    const recorder = mock<WorkRecorderService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkEngineService,
            { provide: LOGGER, useValue: logger },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: OUTBOUND_ACCESS_GATE, useValue: access },
            { provide: WorkItemsService, useValue: items },
            { provide: ModuleCatalogService, useValue: modules },
            { provide: AuthorityRulesService, useValue: rules },
            { provide: WorkIntakeService, useValue: intake },
            { provide: WorkChainService, useValue: chain },
            { provide: WorkApprovalService, useValue: approval },
            { provide: WorkRecorderService, useValue: recorder },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkEngineService),
        items,
        performer,
        insert: intake.insert,
        ask: approval.ask,
        continueChain: chain.continueChain,
        finished: recorder.finished,
        rejected: recorder.rejected,
        failed: recorder.failed,
        accessOf: access.accessOf,
        ruleFor: rules.ruleFor,
        error: logger.error,
    }
}
const run = async (options: WorkEngineFixtureOptions = {}, overrides: Partial<Work.WorkSpec> = {}) => {
    const built = await build(options)
    return { built, item: await built.service.runWork(ctx, specOf(overrides)) }
}

describe("WorkEngineService / durable execution choices", () => {
    it("uses the exact queued draft without preparation and asks when the producer requires approval", async () => {
        const proposal = approvalMessageOf({ summary: "API message", fields: {} })
        const built = await build({ items: { claim: resolved(itemOf({ proposal })) } })

        await built.service.runQueuedItem(ctx, "item-1")

        expect(built.performer?.prepare).not.toHaveBeenCalled()
        expect(built.items.savePrepared).not.toHaveBeenCalled()
        expect(built.ask).toHaveBeenCalledWith(ctx, expect.objectContaining({ proposal }), proposal, authorityAsk)
        expect(built.performer?.perform).not.toHaveBeenCalled()
    })

    it("finishes a queued preset message automatically without chaining", async () => {
        const proposal = messageProposalOf()
        const built = await build({
            items: { nextQueued: resolved(itemOf({ proposal })), claim: resolved(itemOf({ proposal })) },
        })

        expect(await built.service.runQueued(ctx, 1)).toBe(1)
        expect(built.performer?.prepare).not.toHaveBeenCalled()
        expect(built.performer?.perform).toHaveBeenCalledWith(ctx, expect.anything(), proposal, autoPlan.by)
        expect(built.continueChain).not.toHaveBeenCalled()
    })

    it("retains durable choices when preparing a queued proposal", async () => {
        const proposal: Work.Proposal = { ...quote, execution: { noChain: true } }
        const prepared: Work.Proposal = { summary: "Prepared", fields: { items: "coffee" } }
        const built = await build({
            performer: performerOf({ prepare: resolved({ proposal: prepared }) }),
            items: { claim: resolved(itemOf({ proposal })) },
        })

        await built.service.runQueuedItem(ctx, "item-1")

        expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", {
            ...blankPatch,
            proposal: { ...prepared, execution: { preset: undefined, noChain: true, forceAsk: undefined } },
        })
        expect(built.continueChain).not.toHaveBeenCalled()
    })

    it("retains the producer's no-chain choice after a person's approval and edits", async () => {
        const proposal = approvalMessageOf({ draft: "Original" })
        const built = await build({ items: { reopen: resolved(itemOf({ proposal })) } })

        await built.service.resumeWork(ctx, "item-1", "approved", { draft: "Edited" }, owner)

        expect(built.performer?.perform).toHaveBeenCalledWith(
            ctx,
            expect.anything(),
            expect.objectContaining({ draft: "Edited", execution: proposal.execution }),
            { name: "Lan", kind: "owner" },
        )
        expect(built.continueChain).not.toHaveBeenCalled()
    })
})

describe("WorkEngineService / runWork", () => {
    it.each(idleRuns)("returns queued work $label without performing it", async ({ created, queue, held }) => {
        const { built, item } = await run({ created, items: held ? { claim: resolved(null) } : {} }, { queue })
        expect(item).toMatchObject({ id: "item-1", status: "queued" })
        expect(built.items.claim.mock.calls).toEqual(held ? [["ws-1", "item-1"]] : [])
        expect(built.performer?.prepare).not.toHaveBeenCalled()
    })

    it("prepares, passes the gate, performs and logs an automatic item, then continues the chain", async () => {
        const prepared = preparedOrderOf()
        const { proposal } = prepared
        const performer = performerOf({ prepare: resolved(prepared) })
        const saved = itemOf({ lead_id: "lead-2", proposal })
        const { built, item } = await run({ performer, items: { savePrepared: resolved(saved) } })
        expect(item.status).toBe("done")
        expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", preparedAddress)
        expect(built.ruleFor).toHaveBeenCalledWith(ctx, "send_quote", "inst-1")
        expect(built.items.markDone).toHaveBeenCalledWith("item-1", { ...autoResult, proposal })
        expect(built.finished).toHaveBeenCalledWith(ctx, saved, doneItem, proposal, autoPlan, performedOf())
        expect(built.continueChain).toHaveBeenCalledWith(ctx, doneItem)
        expect(built.ask).not.toHaveBeenCalled()
    })

    it("keeps the stored address when the performer corrects none", async () => {
        const { built } = await run({})
        expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", blankPatch)
    })

    it("records the href and the customer the performer found", async () => {
        const performer = performerOf({
            perform: resolved(performedOf({ href: "/quotes/1", lead_id: "lead-9" })),
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
})

describe("WorkEngineService / runWork", () => {
    it.each(recordOnlyCases)("records an action without a performer $label", async ({ action, result }) => {
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
            verdict: objectLike({ verdict: "ask", reason: "not_allowed" }),
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
                items: { claim: resolved(itemOf({ action: "classify_lead" })) },
            },
            { action: "classify_lead", preset: true },
        )
        expect(built.accessOf).not.toHaveBeenCalled()
    })

    it.each(performerFailures)(
        "fails the item and records the normalized failure $message",
        async ({ cause, message }) => {
            const performer = performerOf({ prepare: jest.fn().mockRejectedValue(cause) })
            const { built, item } = await run({ performer })
            expect(item.status).toBe("failed")
            expect(built.items.markFailed).toHaveBeenCalledWith("item-1", message)
            expect(built.failed).toHaveBeenCalledWith(ctx, existingItem, message)
        },
    )

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

describe("WorkEngineService", () => {
    it("hands the finished item to the chain", async () => {
        const built = await build()
        await built.service.continueChain(ctx, itemOf())
        expect(built.continueChain).toHaveBeenCalledWith(ctx, itemOf())
    })

    describe("runQueued", () => {
        it.each(queuedRuns)(
            "processes $count items with a limit of $limit",
            async ({ limit, queued, count, reads }) => {
                const built = await build({ items: { nextQueued: resolved(queued) } })
                expect(await built.service.runQueued(ctx, limit)).toBe(count)
                expect(built.items.nextQueued.mock.calls).toEqual(reads)
            },
        )
        it("processes up to the limit, oldest first, and counts only what it took", async () => {
            const built = await build()
            const { claim, nextQueued } = built.items
            claim.mockResolvedValueOnce(itemOf({ id: "a" })).mockResolvedValueOnce(null)
            nextQueued.mockResolvedValueOnce(itemOf({ id: "a" })).mockResolvedValueOnce(itemOf({ id: "b" }))
            expect(await built.service.runQueued(ctx, 5)).toBe(1)
            expect(claim.mock.calls).toEqual([
                ["ws-1", "a"],
                ["ws-1", "b"],
            ])
            expect(built.finished).toHaveBeenCalledTimes(1)
        })
    })

    describe("queued work", () => {
        it.each([false, true])("runQueuedItem handles a successful claim: %s", async (claimed) => {
            const built = await build({ items: { claim: resolved(claimed ? itemOf() : null) } })
            await expect(built.service.runQueuedItem(ctx, "item-1")).resolves.toEqual(
                claimed ? itemOf({ status: "done" }) : null,
            )
            expect(built.items.claim).toHaveBeenCalledWith("ws-1", "item-1")
            expect(built.items.nextQueued).not.toHaveBeenCalled()
            expect(built.items.nextInboundQueued).not.toHaveBeenCalled()
            if (claimed) {
                expect(built.performer?.prepare).toHaveBeenCalledWith(ctx, itemOf())
                expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", blankPatch)
                expect(built.accessOf).toHaveBeenCalledWith(ctx, itemOf(), quote)
                expect(built.performer?.perform).toHaveBeenCalledWith(ctx, itemOf(), quote, autoPlan.by)
                expect(built.items.markDone).toHaveBeenCalledWith("item-1", { ...autoResult, proposal: quote })
                expect(built.finished).toHaveBeenCalledWith(ctx, itemOf(), doneItem, quote, autoPlan, performedOf())
                expect(built.continueChain).toHaveBeenCalledWith(ctx, doneItem)
            } else expect(built.performer?.prepare).not.toHaveBeenCalled()
        })
        it.each(inboundBatches)(
            "runInboundQueued bounds input claims to a batch of $limit",
            async ({ limit, queued, claimed, reads, claims, count }) => {
                const built = await build()
                for (const row of queued) built.items.nextInboundQueued.mockResolvedValueOnce(row)
                for (const row of claimed) built.items.claim.mockResolvedValueOnce(row)
                await expect(built.service.runInboundQueued(ctx, "event-1", limit)).resolves.toBe(count)
                expect(built.items.nextInboundQueued.mock.calls).toEqual(reads)
                expect(built.items.claim.mock.calls).toEqual(claims)
                expect(built.items.nextQueued).not.toHaveBeenCalled()
                expect(built.performer?.prepare).toHaveBeenCalledTimes(count)
                expect(built.items.markDone).toHaveBeenCalledTimes(count)
            },
        )
    })
})

describe("WorkEngineService / resumeWork", () => {
    it("refuses a decision on an item that no longer waits", async () => {
        const built = await build({ items: { reopen: resolved(null) } })
        await expect(built.service.resumeWork(ctx, "item-1", "approved", {}, owner)).rejects.toThrow(
            DecisionsErrorCode.NotWaiting,
        )
        expect(built.items.reopen).toHaveBeenCalledWith("ws-1", "item-1")
    })

    it("stops the work with the action's undo and tells the people", async () => {
        const onReject = resolved(undefined)
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

    it.each(decisionFailures)("fails and rethrows a %s decision", async (decision, method, message) => {
        const performer = performerOf({ [method]: jest.fn().mockRejectedValue(new RangeError(message)) })
        const built = await build({ performer, rule: decision === "approved" ? ruleOf({ mode: "ask" }) : ruleOf() })
        await expect(built.service.resumeWork(ctx, "item-1", decision, {}, owner)).rejects.toThrow(message)
        expect(built.failed).toHaveBeenCalledWith(ctx, existingItem, message)
    })

    it.each(
        approvalCases.map(
            ([label, edits, note, outcome, proposal]) => [label, edits, note, outcome, objectLike(proposal)] as const,
        ),
    )("logs an %s approval", async (_, edits, note, outcome, proposal) => {
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
})

describe("WorkEngineService / candidate decisions", () => {
    const proposal: Work.Proposal = { summary: "Pay", fields: {}, candidates }
    it("asks the person to choose among several candidates", async () => {
        const built = await build({
            items: { reopen: resolved(itemOf({ proposal, reason: "unclear_outcome" })) },
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
            items: { reopen: resolved(itemOf({ proposal })) },
        })
        await built.service.resumeWork(ctx, "item-1", "approved", { candidateId: "inv-2" }, owner)
        const chosen = objectLike({ candidates: [candidates[1]] })
        expect(built.finished).toHaveBeenCalledWith(ctx, anyValue, anyValue, chosen, anyValue, anyValue)
    })
})

describe("WorkEngineService / inputs to work", () => {
    const event: InboundWorkSource = { id: "event-1" }
    it("starts the department's work for an inbound event", async () => {
        const built = await build({ created: false })
        await built.service.startInboundWork(ctx, event, "reply_customer", replySeed, "lead-1")
        expect(built.insert).toHaveBeenCalledWith(ctx, inboundReply)
    })
    it("starts the confirmation of an order", async () => {
        const built = await build({ created: false })
        await built.service.startOrderWork(ctx, event, { items: "tea", amount_vnd: 500, lead_id: "lead-2" })
        await built.service.startOrderWork(ctx, event, { items: "tea", amount_vnd: null })
        expect(built.insert.mock.calls.map(([, spec]) => [spec.action, spec.lead_id, spec.seed])).toEqual(orderSeeds)
    })
})
