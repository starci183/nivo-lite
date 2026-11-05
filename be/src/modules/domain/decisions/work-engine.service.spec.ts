import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { WorkItemsService } from "@modules/domain/work-items"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import { LOGGER } from "@modules/platform/logging"
import * as harness from "@tests/fixtures/builders/work-engine-harness.builder"
import { ModuleCatalogService } from "./module-catalog.service"
import { WorkApprovalService } from "./work-approval.service"
import { WorkBranchService } from "./work-branch.service"
import { WorkChainService } from "./work-chain.service"
import { OUTBOUND_ACCESS_GATE } from "./work-engine.decorators"
import { WorkEngineService } from "./work-engine.service"
import { WorkIntakeService } from "./work-intake.service"
import { WorkItemClosedService } from "./work-item-closed.service"
import { WORK_PERFORMER_REGISTRY } from "./work-performer.port"
import { WorkRecorderService } from "./work-recorder.service"
import type * as Work from "./decisions.contracts"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { WorkEngineLogEvent } from "./work-engine.log-events"
import * as fx from "@tests/fixtures/builders/work-engine.builder"
type EngineDependencies = ConstructorParameters<typeof WorkEngineService>
const resolved = <T>(value: T) => jest.fn().mockResolvedValue(value)
const build = async (options: fx.WorkEngineFixtureOptions = {}) => {
    const em = mockEntityManager()
    const tx = fakeTransaction(em)
    const logger = mock<EngineDependencies[1]>()
    const catalog = mock<EngineDependencies[2]>()
    const registry = mock<EngineDependencies[3]>()
    const access = mock<EngineDependencies[4]>()
    const items = mock<EngineDependencies[5]>()
    const modules = mock<EngineDependencies[6]>()
    const rules = mock<EngineDependencies[7]>()
    const intake = mock<EngineDependencies[8]>()
    const chain = mock<EngineDependencies[9]>()
    const approval = mock<EngineDependencies[10]>()
    const recorder = mock<EngineDependencies[11]>()
    const branching = mock<EngineDependencies[12]>()
    const closed = mock<EngineDependencies[13]>()
    const policyDoubles = { catalog, modules, items, access, rules }
    const executionDoubles = { registry, intake, chain, approval, recorder, branching }
    const doubles = harness.engineDoublesOf(options, { tx, logger, closed, ...policyDoubles, ...executionDoubles })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkEngineService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
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
            { provide: WorkBranchService, useValue: branching },
            { provide: WorkItemClosedService, useValue: closed },
        ],
    }).compile()
    return { ...doubles, service: moduleRef.get(WorkEngineService) }
}
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const existingItem = objectLike({ id: "item-1" })
const doneItem = objectLike({ status: "done" })
const waitingItem = objectLike({ id: "item-1", reason: "over_authority" })
const humanDone = objectLike({ path: "human" })
const { autoPlan, autoResult, blankPatch } = fx
const authorityAsk = objectLike({ verdict: objectLike(fx.overAuthorityVerdict) })
const anyValue: unknown = expect.anything()
const editedDraft = objectLike({ draft: "x" })
const run = async (options: fx.WorkEngineFixtureOptions = {}, overrides: Partial<Work.WorkSpec> = {}) => {
    const built = await build(options)
    return { built, item: await built.service.runWork(fx.ctx, fx.specOf(overrides)) }
}

const approve = (built: Awaited<ReturnType<typeof build>>, edits: Work.WorkEdits = {}) =>
    built.service.resumeWork(fx.ctx, "item-1", "approved", edits, fx.owner)

describe("WorkEngineService / durable execution choices", () => {
    it("uses the exact queued draft without preparation and asks when the producer requires approval", async () => {
        const proposal = fx.approvalMessageOf({ summary: "API message", fields: {} })
        const built = await build({ items: { claim: resolved(fx.itemOf({ proposal })) } })
        await built.service.runQueuedItem(fx.ctx, "item-1")
        expect(built.performer?.prepare).not.toHaveBeenCalled()
        expect(built.items.savePrepared).not.toHaveBeenCalled()
        expect(built.approval.ask).toHaveBeenCalledWith(
            ...fx.durableAskArgsOf(objectLike({ proposal }), proposal, authorityAsk),
        )
        expect(built.performer?.perform).not.toHaveBeenCalled()
    })

    it("finishes a queued preset message automatically without chaining", async () => {
        const proposal = fx.messageProposalOf()
        const built = await build(fx.queuedPresetOptions(proposal))
        expect(await built.service.runQueued(fx.ctx, 1)).toBe(1)
        expect(built.performer?.prepare).not.toHaveBeenCalled()
        expect(built.performer?.perform).toHaveBeenCalledWith(fx.ctx, expect.anything(), proposal, autoPlan.by)
        expect(built.chain.continueChain).not.toHaveBeenCalled()
    })

    it("retains durable choices when preparing a queued proposal", async () => {
        const built = await build(harness.durableOptionsOf())
        await built.service.runQueuedItem(fx.ctx, "item-1")
        expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", fx.durablePreparation.saved)
        expect(built.chain.continueChain).not.toHaveBeenCalled()
    })

    it("retains noChain after approving and editing an order that has an invoice successor", async () => {
        const proposal = fx.approvalMessageOf({ draft: "Original" })
        const built = await build(fx.noChainOrderOptions(proposal))
        const completed = await approve(built, { draft: "Edited" })
        expect(completed.status).toBe("done")
        expect(built.performer?.perform).toHaveBeenCalledWith(
            fx.ctx,
            expect.objectContaining({ action: "confirm_order" }),
            expect.objectContaining({ draft: "Edited", execution: proposal.execution }),
            { name: "Lan", kind: "owner" },
        )
        expect(built.chain.continueChain).not.toHaveBeenCalled()
    })
})

describe("WorkEngineService / runWork", () => {
    it.each(fx.idleRuns)("returns queued work $label without performing it", async ({ created, queue, held }) => {
        const { built, item } = await run({ created, items: held ? { claim: resolved(null) } : {} }, { queue })
        expect(item).toMatchObject({ id: "item-1", status: "queued" })
        expect(built.items.claim.mock.calls).toEqual(held ? [["ws-1", "item-1"]] : [])
        expect(built.performer?.prepare).not.toHaveBeenCalled()
    })

    it("prepares, passes the gate, performs and logs an automatic item, then continues the chain", async () => {
        const prepared = fx.preparedOrderOf()
        const { proposal } = prepared
        const performer = harness.performerOf({ prepare: resolved(prepared) })
        const saved = fx.itemOf({ lead_id: "lead-2", proposal })
        const { built, item } = await run({ performer, items: { savePrepared: resolved(saved) } })
        expect(item.status).toBe("done")
        expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", fx.preparedAddress)
        expect(built.rules.ruleFor).toHaveBeenCalledWith(fx.ctx, "send_quote", "inst-1")
        expect(built.items.markDone).toHaveBeenCalledWith("item-1", { ...autoResult, proposal })
        expect(built.recorder.finished).toHaveBeenCalledWith(...fx.autoFinishArgsOf(saved, doneItem, proposal))
        expect(built.chain.continueChain).toHaveBeenCalledWith(fx.ctx, doneItem)
        expect(built.approval.ask).not.toHaveBeenCalled()
    })

    it("keeps the stored address when the performer corrects none", async () => {
        const { built } = await run({})
        expect(built.items.savePrepared).toHaveBeenCalledWith("item-1", blankPatch)
    })

    it("records the href and the customer the performer found", async () => {
        const performer = harness.performerOf({
            perform: resolved(fx.performedOf({ href: "/quotes/1", lead_id: "lead-9" })),
        })
        const { built } = await run({ performer })
        expect(built.items.markDone).toHaveBeenCalledWith("item-1", expect.objectContaining(fx.linkedQuoteResult))
    })

    it("skips the prepare step of a preset item and the chain of a no-chain item", async () => {
        const { built } = await run({}, { preset: true, noChain: true })
        expect(built.performer?.prepare).not.toHaveBeenCalled()
        expect(built.items.savePrepared).not.toHaveBeenCalled()
        expect(built.recorder.finished).toHaveBeenCalledTimes(1)
        expect(built.chain.continueChain).not.toHaveBeenCalled()
    })
})

describe("WorkEngineService / runWork", () => {
    it.each(fx.recordOnlyCases)("records an action without a performer $label", async ({ action, result }) => {
        const { built } = await run({ performer: null, action })
        expect(built.items.markDone).toHaveBeenCalledWith(
            "item-1",
            expect.objectContaining({ result, evidence: "pending", leadId: "lead-1" }),
        )
    })

    it("asks a person when the owner has granted no rule", async () => {
        const { built, item } = await run({ rule: null })
        expect(item.status).toBe("waiting_decision")
        expect(built.approval.ask).toHaveBeenCalledWith(fx.ctx, existingItem, fx.quote, {
            verdict: objectLike({ verdict: "ask", reason: "not_allowed" }),
            rule: null,
        })
        expect(built.recorder.finished).not.toHaveBeenCalled()
    })

    it("makes an action nobody listed and nobody gave a rule a generic owner decision, with its name kept", async () => {
        const { built, item } = await run(...harness.genericOwnerRunOf())
        expect(item.status).toBe("waiting_decision")
        expect(built.approval.ask).toHaveBeenCalledWith(fx.ctx, anyValue, anyValue, {
            verdict: objectLike({ verdict: "ask", reason: "branch_ask" }),
            rule: objectLike({ action: "connect_sepay", mode: "ask", id: "generic:connect_sepay" }),
        })
    })

    it("runs by the tag right when the owner has granted no rule, and leaves a stored ask rule to the owner", async () => {
        const tagged = await run({ rule: null }, { tagGrant: true })
        const stored = await run({ rule: fx.ruleOf({ mode: "ask" }) }, { tagGrant: true })
        expect(tagged.built.modules.tagRuleOf).toHaveBeenCalledWith("send_quote")
        expect(tagged.built.approval.ask).not.toHaveBeenCalled()
        expect(tagged.built.recorder.finished).toHaveBeenCalledTimes(1)
        expect(stored.built.modules.tagRuleOf).not.toHaveBeenCalled()
        expect(stored.built.approval.ask).toHaveBeenCalled()
    })

    it("asks a person when the item was forced to ask", async () => {
        const { built } = await run({}, { preset: true, forceAsk: "unclear_outcome" })
        expect(built.approval.ask).toHaveBeenCalledWith(fx.ctx, anyValue, anyValue, fx.unclearGate)
    })

    it.each(["auto", "ask", "read"] as const)("honors the %s outbound grant", async (access) => {
        const { built } = await run({ access }, { preset: true })
        if (access === "auto") {
            expect(built.access.accessOf).toHaveBeenCalledWith(fx.ctx, existingItem, anyValue)
            expect(built.recorder.finished).toHaveBeenCalledTimes(1)
        } else {
            expect(built.approval.ask).toHaveBeenCalledWith(fx.ctx, anyValue, anyValue, authorityAsk)
        }
    })

    it("does not look at the access of an action that sends no message", async () => {
        const { built } = await run(fx.classificationOptions(), fx.classificationSpec)
        expect(built.access.accessOf).not.toHaveBeenCalled()
    })

    it.each(fx.performerFailures)(
        "fails the item and records the normalized failure $message",
        async ({ cause, message }) => {
            const performer = harness.performerOf({ prepare: jest.fn().mockRejectedValue(cause) })
            const { built, item } = await run({ performer })
            expect(item.status).toBe("failed")
            expect(built.items.markFailed).toHaveBeenCalledWith("item-1", message)
            expect(built.recorder.failed).toHaveBeenCalledWith(fx.ctx, existingItem, message)
        },
    )

    it("still answers a failed item when the failure cannot be saved", async () => {
        const { built, item } = await run(harness.unsavableFailureOptions())
        expect(item).toEqual(expect.objectContaining({ status: "failed", error: "send failed" }))
        expect(built.logger.error).toHaveBeenCalledWith(WorkEngineLogEvent.MarkFailedFailed, expect.any(RangeError), {
            workItemId: "item-1",
        })
    })
})

describe("WorkEngineService / the graph of the agent", () => {
    it.each(fx.graphClosures)(
        "closes a %s item as rejected, asks nobody and performs nothing",
        async (_label, outcome, note, inserts) => {
            const built = await build()
            built.branching.consult.mockResolvedValueOnce(outcome())
            await expect(built.service.runWork(fx.ctx, fx.specOf())).resolves.toMatchObject({ status: "rejected" })
            const summary = { summary: "engine.rejectedResult()" }
            expect(built.items.markRejected).toHaveBeenCalledWith("item-1", fx.quote, summary, expect.anything())
            expect(built.recorder.rejected).toHaveBeenCalledWith(...fx.graphRejectionArgsOf(existingItem, note))
            expect(built.performer?.perform).not.toHaveBeenCalled()
            expect(built.intake.insert).toHaveBeenCalledTimes(inserts)
            expect(built.approval.ask).toHaveBeenCalledTimes(inserts - 1)
        },
    )

    it("runs the action the graph names on the same subject, with a person to decide it", async () => {
        const built = await build()
        built.branching.consult.mockResolvedValueOnce(fx.divertedByGraph())
        await built.service.runWork(fx.ctx, fx.specOf())
        expect(built.intake.insert.mock.calls[1]?.[1]).toMatchObject(fx.divertedWork)
    })

    it("starts a diverted action that names its own target with no ask and no target of ours", async () => {
        const built = await build()
        const divert = { action: "hand_over_conversation", handoverTo: null, asks: false }
        await built.service.runDiverted(fx.ctx, divert, fx.replySource)
        const spec = built.intake.insert.mock.calls[0]?.[1]
        expect(spec).toMatchObject(fx.unaskedDivertedWork)
        expect(spec).not.toHaveProperty("forceAsk")
    })

    it("asks the graph about something that leaves with no work item", async () => {
        const built = await build()
        built.branching.check.mockResolvedValue(fx.stopAnswer)
        await expect(built.service.checkGraph(fx.replyCheck)).resolves.toBe(fx.stopAnswer)
        expect(built.branching.check).toHaveBeenCalledWith(fx.replyCheck)
    })
})

describe("WorkEngineService", () => {
    it("hands the finished item to the chain", async () => {
        const built = await build()
        await built.service.continueChain(fx.ctx, fx.itemOf())
        expect(built.chain.continueChain).toHaveBeenCalledWith(fx.ctx, fx.itemOf())
    })

    describe("runQueued", () => {
        it.each(fx.queuedRuns)(
            "processes $count items with a limit of $limit",
            async ({ limit, queued, count, reads }) => {
                const built = await build({ items: { nextQueued: resolved(queued) } })
                expect(await built.service.runQueued(fx.ctx, limit)).toBe(count)
                expect(built.items.nextQueued.mock.calls).toEqual(reads)
            },
        )
        it("processes up to the limit, oldest first, and counts only what it took", async () => {
            const built = await build()
            const { claim } = built.items
            fx.arrangeQueuedContention(built.items)
            expect(await built.service.runQueued(fx.ctx, 5)).toBe(1)
            expect(claim.mock.calls).toEqual(fx.queuedContentionReads)
            expect(built.recorder.finished).toHaveBeenCalledTimes(1)
        })
    })

    describe("queued work", () => {
        it.each([false, true])("runQueuedItem handles a successful claim: %s", async (claimed) => {
            const built = await build({ items: { claim: resolved(claimed ? fx.itemOf() : null) } })
            await expect(built.service.runQueuedItem(fx.ctx, "item-1")).resolves.toEqual(
                claimed ? fx.itemOf({ status: "done" }) : null,
            )
            expect(built.items.claim).toHaveBeenCalledWith("ws-1", "item-1")
            expect(built.items.nextQueued).not.toHaveBeenCalled()
            expect(built.items.nextInboundQueued).not.toHaveBeenCalled()
            if (claimed) {
                for (const [call, args] of harness.claimedRunCalls(built, doneItem))
                    expect(call).toHaveBeenCalledWith(...args)
            } else expect(built.performer?.prepare).not.toHaveBeenCalled()
        })
        it.each(fx.inboundBatches)(
            "runInboundQueued bounds input claims to a batch of $limit",
            async ({ limit, queued, claimed, reads, claims, count }) => {
                const built = await build()
                for (const row of queued) built.items.nextInboundQueued.mockResolvedValueOnce(row)
                for (const row of claimed) built.items.claim.mockResolvedValueOnce(row)
                await expect(built.service.runInboundQueued(fx.ctx, "event-1", limit)).resolves.toBe(count)
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
        await expect(approve(built)).rejects.toThrow(DecisionsErrorCode.NotWaiting)
        expect(built.items.reopen).toHaveBeenCalledWith("ws-1", "item-1")
    })

    it("stops the work with the action's undo and tells the people", async () => {
        const onReject = resolved(undefined)
        const built = await build({ performer: harness.performerOf({ onReject }) })
        const item = await built.service.resumeWork(fx.ctx, "item-1", "rejected", { draft: "x" }, fx.owner, "no")
        expect(item.status).toBe("rejected")
        expect(onReject).toHaveBeenCalledWith(fx.ctx, existingItem, anyValue, fx.owner)
        expect(built.items.markRejected).toHaveBeenCalledWith(...fx.rejectionMarkArgsOf(expect.anything()))
        expect(built.recorder.rejected).toHaveBeenCalledWith(fx.ctx, existingItem, editedDraft, fx.owner, "no", true)
    })

    it("needs no undo from a performer without one, or from an action without a performer", async () => {
        const plain = await build()
        const none = await build({ performer: null })
        await plain.service.resumeWork(fx.ctx, "item-1", "rejected", {}, fx.owner)
        await none.service.resumeWork(fx.ctx, "item-1", "rejected", {}, fx.owner)
        expect(plain.recorder.rejected).toHaveBeenCalledWith(fx.ctx, anyValue, anyValue, fx.owner, null, true)
        expect(none.recorder.rejected).toHaveBeenCalledTimes(1)
    })

    it.each(fx.decisionFailures)("fails and rethrows a %s decision", async (decision, method, message) => {
        const built = await build(harness.decisionFailureOptions(decision, method, message))
        await expect(built.service.resumeWork(fx.ctx, "item-1", decision, {}, fx.owner)).rejects.toThrow(message)
        expect(built.recorder.failed).toHaveBeenCalledWith(fx.ctx, existingItem, message)
    })

    it.each(fx.approvalCases)("logs an %s approval", async (_, edits, note, outcome, proposal) => {
        const built = await build({ rule: fx.ruleOf({ mode: "ask" }) })
        const item = await built.service.resumeWork(fx.ctx, "item-1", "approved", edits, fx.owner, note)
        expect(item.status).toBe("done")
        expect(built.items.markDone).toHaveBeenCalledWith("item-1", humanDone, expect.anything())
        const plan = { path: "human", by: fx.owner, outcome, note, before: fx.quote }
        expect(built.recorder.finished).toHaveBeenCalledWith(
            ...fx.recordedFinishArgsOf(waitingItem, doneItem, objectLike(proposal), plan),
        )
        expect(built.chain.continueChain).toHaveBeenCalledTimes(1)
    })

    it("sends the item back to waiting and names the fields that are still missing", async () => {
        const built = await build({ rule: fx.ruleOf({ required_fields: ["need"] }) })
        await expect(approve(built)).rejects.toMatchObject(fx.missingFieldsError)
        expect(built.items.markStillWaiting).toHaveBeenCalledWith("item-1", fx.stillMissingData)
        expect(built.recorder.finished).not.toHaveBeenCalled()
    })
})

describe("WorkEngineService / candidate decisions", () => {
    it("asks the person to choose among several candidates", async () => {
        const built = await build(fx.ambiguousCandidateOptions())
        await expect(approve(built)).rejects.toMatchObject(fx.chooseCandidateError)
        expect(built.items.markStillWaiting).toHaveBeenCalledWith(
            "item-1",
            expect.objectContaining({ proposal: fx.candidateProposal, reason: "unclear_outcome" }),
        )
    })

    it("accepts the chosen candidate", async () => {
        const built = await build(fx.chosenCandidateOptions())
        await approve(built, { candidateId: "inv-2" })
        const chosen = objectLike({ candidates: [fx.candidates[1]] })
        expect(built.recorder.finished).toHaveBeenCalledWith(
            ...fx.recordedFinishArgsOf(anyValue, anyValue, chosen, anyValue, anyValue),
        )
    })
})

describe("WorkEngineService / inputs to work", () => {
    const event = fx.inboundEvent
    it("starts the department's work for an inbound event", async () => {
        const built = await build({ created: false })
        await built.service.startInboundWork(fx.ctx, event, "reply_customer", fx.replySeed, "lead-1")
        expect(built.intake.insert).toHaveBeenCalledWith(fx.ctx, fx.inboundReply)
    })
    it("starts the confirmation of an order", async () => {
        const built = await build({ created: false })
        await built.service.startOrderWork(fx.ctx, event, { items: "tea", amount_vnd: 500, lead_id: "lead-2" })
        await built.service.startOrderWork(fx.ctx, event, { items: "tea", amount_vnd: null })
        expect(built.intake.insert.mock.calls.map(([, spec]) => [spec.action, spec.lead_id, spec.seed])).toEqual(
            fx.orderSeeds,
        )
    })
})

describe("WorkEngineService atomic human closure", () => {
    it("commits the same manager's item close, approved snapshot and principal before notifications", async () => {
        const built = await build({ rule: fx.ruleOf({ mode: "ask" }) })
        built.finished.mockImplementation(() => {
            expect(built.tx.commits).toBe(1)
            return Promise.resolve()
        })
        await approve(built, { draft: "Approved text" })
        const manager = built.items.markDone.mock.calls[0]?.[2]
        const expected = fx.authoritativeFinishArgsOf(
            manager,
            waitingItem,
            doneItem,
            objectLike({ draft: "Approved text" }),
            objectLike({ by: fx.owner }),
        )
        expect(built.recorder.recordFinished).toHaveBeenCalledWith(...expected)
        expect(built.tx.commits).toBe(1)
    })

    it("rolls back a close whose authoritative decision cannot be written and never announces it", async () => {
        const built = await build({ rule: fx.ruleOf({ mode: "ask" }) })
        built.recorder.recordFinished.mockRejectedValue(new Error("decision-write-failed"))
        await expect(approve(built)).rejects.toThrow("decision-write-failed")
        expect(built.tx.commits).toBe(0)
        expect(built.finished).not.toHaveBeenCalled()
    })

    it("keeps a committed approval closed when a later notification fails", async () => {
        const built = await build({ rule: fx.ruleOf({ mode: "ask" }) })
        built.finished.mockRejectedValue(new Error("office-unavailable"))
        await expect(approve(built)).resolves.toMatchObject(fx.doneState)
        expect(built.failed).not.toHaveBeenCalled()
        expect(built.tx.commits).toBe(1)
    })
})

describe("WorkEngineService / close notifications", () => {
    it.each(fx.autoNotificationFailures)("fails automatic work when $target rejects", async (failure) => {
        const { built, item } = await run(fx.notificationOptions(failure))
        expect(item.status).toBe("failed")
        expect(built.items.markDone).toHaveBeenCalledTimes(1)
        expect(built.items.markFailed).toHaveBeenCalledWith("item-1", failure.cause.message)
        expect(built.failed).toHaveBeenCalledWith(fx.ctx, existingItem, failure.cause.message)
        expect(built.error).not.toHaveBeenCalled()
    })
    it("keeps a committed human rejection closed when its notification fails", async () => {
        const failure = fx.rejectedNotificationFailure
        const built = await build(fx.notificationOptions(failure))
        const item = await built.service.resumeWork(fx.ctx, "item-1", "rejected", {}, fx.owner)
        const manager = built.items.markRejected.mock.calls[0]?.[3]
        expect(item.status).toBe("rejected")
        expect(built.tx.commits).toBe(1)
        expect(manager).toBeDefined()
        expect(built.recorder.recordRejected).toHaveBeenCalledWith(
            ...fx.authoritativeRejectionArgsOf(manager, existingItem),
        )
        expect(built.items.markFailed).not.toHaveBeenCalled()
        expect(built.failed).not.toHaveBeenCalled()
        expect(built.error).toHaveBeenCalledWith(WorkEngineLogEvent.ClosedNotificationFailed, failure.cause, {
            workItemId: "item-1",
        })
    })
})
