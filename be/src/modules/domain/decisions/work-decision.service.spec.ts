import { itemOf } from "../../../tests/fixtures/builders/work-decision.builder"
import { builder, mock } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLAIM_LEASE_SECONDS } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { WORK_BRANCH_DECIDER } from "@modules/domain/authority-rules"
import type { WorkBranchDecider } from "@modules/domain/authority-rules"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Decider, WorkItem } from "./decisions.contracts"
import { CommandBusService } from "./command-bus.service"
import { DecisionsService } from "./decisions.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { WorkDecisionRequest } from "./work-decision.contracts"
import { WorkDecisionService } from "./work-decision.service"
import { WorkEngineService } from "./work-engine.service"

const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})
const requestOf = builder<WorkDecisionRequest>({
    workItemId: "item-1",
    decision: "approved",
    edits: {},
    note: null,
    basis: null,
    locale: "en",
})
interface Setup {
    readonly member?: WorkspaceMember
    readonly item?: WorkItem
    readonly mayDecide?: boolean
}
const build = async (setup: Setup = {}) => {
    const done = itemOf({ status: "done" })
    const require = jest.fn().mockResolvedValue(setup.member ?? memberOf())
    const getWorkItem = jest.fn().mockResolvedValue(setup.item ?? itemOf())
    const resumeWork = jest.fn().mockResolvedValue(done)
    const log = jest.fn().mockResolvedValue(undefined)
    const sendCommand = jest.fn().mockResolvedValue({ ok: true })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `${key}()`) })
    const members = mock<WorkspaceMembersService>({ require, idOf: jest.fn().mockResolvedValue("member-1") })
    const bus = mock<CommandBusService>({ sendCommand })
    const decisions = mock<DecisionsService>({ getWorkItem })
    const engine = mock<WorkEngineService>({ resumeWork })
    engine.runQueuedItem.mockResolvedValue(done)
    engine.runQueued.mockResolvedValue(3)
    const branches = mock<WorkBranchDecider>({ mayDecide: jest.fn().mockResolvedValue(setup.mayDecide ?? true) })
    const evidence = mock<EvidenceService>({ log })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkDecisionService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CommandBusService, useValue: bus },
            { provide: DecisionsService, useValue: decisions },
            { provide: WorkEngineService, useValue: engine },
            { provide: EvidenceService, useValue: evidence },
            { provide: WORK_BRANCH_DECIDER, useValue: branches },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkDecisionService),
        resumeWork,
        log,
        done,
        sendCommand,
        require,
        members,
        decisions,
        engine,
        branches,
    }
}
const owner: Decider = { name: "An", kind: "owner", memberId: "member-1" }
const ctxOf = (actor: string) => ({ workspaceId: "ws-1", actor, locale: "en" })
const ctx = ctxOf("An")
const queuedOf = (overrides: Partial<WorkItem> = {}) => itemOf({ status: "queued", ...overrides })
describe("WorkDecisionService", () => {
    describe("decide", () => {
        it("resumes the work as the owner with the edits and the note", async () => {
            const { service, resumeWork, done, log } = await build()
            const result = await service.decide(
                "user-1",
                "ws-1",
                requestOf({ edits: { draft: "New" }, note: " thanks " }),
            )
            expect(result).toBe(done)
            expect(resumeWork).toHaveBeenCalledWith(ctx, "item-1", "approved", { draft: "New" }, owner, "thanks")
            expect(log).not.toHaveBeenCalled()
        })
        it("decides with nothing but the verdict", async () => {
            const { service, resumeWork } = await build()
            await service.decide("user-1", "ws-1", { workItemId: "item-1", decision: "approved", locale: "en" })
            expect(resumeWork).toHaveBeenCalledWith(ctx, "item-1", "approved", {}, owner, null)
        })
        it("lets staff decide an item assigned to them and records them as staff", async () => {
            const member = memberOf({ role: "staff", staffId: "staff-1", displayName: "Binh" })
            const { service, resumeWork } = await build({ member, item: itemOf({ assigned_staff_id: "staff-1" }) })
            await service.decide("user-1", "ws-1", requestOf({ decision: "rejected" }))
            expect(resumeWork).toHaveBeenCalledWith(
                ctxOf("Binh"),
                "item-1",
                "rejected",
                {},
                { name: "Binh", kind: "staff", memberId: "member-1" },
                null,
            )
        })
        it("asks the action graph whether this seat may answer, and refuses a seat the branch did not name", async () => {
            const { service, resumeWork, branches } = await build({ mayDecide: false })
            await expect(service.decide("user-1", "ws-1", requestOf())).rejects.toThrow(DecisionsErrorCode.NotAllowed)
            expect(branches.mayDecide).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                workItemId: "item-1",
                memberId: "member-1",
                isOwner: true,
            })
            expect(resumeWork).not.toHaveBeenCalled()
        })
        it("refuses staff an item that is not assigned to them", async () => {
            const { service, resumeWork } = await build({ member: memberOf({ role: "staff", staffId: "staff-1" }) })
            await expect(service.decide("user-1", "ws-1", requestOf())).rejects.toThrow(DecisionsErrorCode.NotAllowed)
            expect(resumeWork).not.toHaveBeenCalled()
        })
        it("refuses to approve a payment reconciliation without a written basis", async () => {
            const { service, resumeWork } = await build({ item: itemOf({ action: "reconcile_payment" }) })
            await expect(service.decide("user-1", "ws-1", requestOf({ basis: "short" }))).rejects.toThrow(
                DecisionsErrorCode.BasisRequired,
            )
            expect(resumeWork).not.toHaveBeenCalled()
        })
        it("rejects a payment reconciliation without asking for a basis", async () => {
            const { service, resumeWork } = await build({ item: itemOf({ action: "reconcile_payment" }) })
            await service.decide("user-1", "ws-1", requestOf({ decision: "rejected", basis: "ignored basis text" }))
            expect(resumeWork).toHaveBeenCalledTimes(1)
        })
        it("keeps the basis in the note and the evidence log", async () => {
            const { service, resumeWork, log, done } = await build({ item: itemOf({ action: "reconcile_payment" }) })
            await service.decide(
                "user-1",
                "ws-1",
                requestOf({ basis: "  the customer   sent a screenshot ", note: "ok" }),
            )
            expect(resumeWork).toHaveBeenCalledWith(ctx, "item-1", "approved", {}, owner, "decision.basisNote() · ok")
            expect(log).toHaveBeenCalledWith(ctx, {
                lead_id: done.lead_id,
                work_item_id: done.id,
                kind: "decision.basis",
                actor: "An",
                summary: "decision.basisNote()",
                evidence: "the customer sent a screenshot",
            })
        })
    })
})

describe("WorkDecisionService", () => {
    describe("sendCommand", () => {
        const request = {
            to: "sales",
            command: "confirm_order",
            subjectType: "order",
            subjectId: "o-1",
            fields: [{ name: "items", text: "tea" }],
            reason: "owner asked",
            locale: "en" as const,
        }
        it("sends the command as the owner after proving the manager role", async () => {
            const { service, sendCommand, require } = await build()
            expect(await service.sendCommand("user-1", "ws-1", request)).toEqual({ ok: true })
            expect(require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
            expect(sendCommand).toHaveBeenCalledWith(ctx, {
                from: "owner",
                to: "sales",
                command: "confirm_order",
                payload: { items: "tea", subject_type: "order", subject_id: "o-1" },
                reason: "owner asked",
            })
        })
    })
})

describe("WorkDecisionService queued work", () => {
    it("retries the requested item before draining three further queued steps", async () => {
        const { service, members, decisions, engine } = await build({ item: queuedOf() })
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "retry")).resolves.toBeUndefined()
        expect(decisions.getWorkItem).toHaveBeenCalledTimes(1)
        expect(decisions.getWorkItem).toHaveBeenCalledWith("user-1", "ws-1", "item-1")
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(engine.runQueuedItem).toHaveBeenCalledWith(ctx, "item-1")
        expect(engine.runQueued).toHaveBeenCalledWith(ctx, 3)
        for (const drainCall of engine.runQueued.mock.invocationCallOrder) {
            expect(engine.runQueuedItem.mock.invocationCallOrder[0]).toBeLessThan(drainCall)
        }
    })
    it("refuses a retry by staff who are not assigned the item", async () => {
        const { service, engine } = await build({
            item: queuedOf(),
            member: memberOf({ role: "staff", staffId: "staff-1" }),
        })
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "retry")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotAllowed,
        })
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
        expect(engine.runQueued).not.toHaveBeenCalled()
    })
    it("hands off an order invoice for a member without a decision assignment", async () => {
        const item = queuedOf({ action: "issue_invoice", subject_type: "order", subject_id: "order-1" })
        const member = memberOf({ role: "staff", staffId: "staff-1", displayName: "Binh" })
        const { service, engine } = await build({ item, member })
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "handoff")).resolves.toBeUndefined()
        expect(engine.runQueuedItem).toHaveBeenCalledWith({ ...ctx, actor: "Binh" }, "item-1")
        expect(engine.runQueued).toHaveBeenCalledWith({ ...ctx, actor: "Binh" }, 3)
    })
    it.each([
        { name: "a different action", item: queuedOf({ action: "send_follow_up", subject_type: "order" }) },
        {
            name: "an invoice for a different subject",
            item: queuedOf({ action: "issue_invoice", subject_type: "lead" }),
        },
    ])("refuses to hand off $name", async ({ item }) => {
        const { service, engine } = await build({ item })
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "handoff")).rejects.toMatchObject({
            code: DecisionsErrorCode.NotAllowed,
        })
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
        expect(engine.runQueued).not.toHaveBeenCalled()
    })
    it("returns after proving membership when the item is no longer queued", async () => {
        const { service, members, engine } = await build({ item: queuedOf({ status: "done" }) })
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "retry")).resolves.toBeUndefined()
        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(engine.runQueuedItem).not.toHaveBeenCalled()
        expect(engine.runQueued).not.toHaveBeenCalled()
    })
    it("reports the claim lease when the requested item remains queued after a failed claim", async () => {
        const { service, decisions, engine } = await build({ item: queuedOf() })
        engine.runQueuedItem.mockResolvedValue(null)
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "retry")).rejects.toMatchObject({
            code: DecisionsErrorCode.WorkBusy,
            params: { retryAfterSeconds: CLAIM_LEASE_SECONDS },
        })
        expect(decisions.getWorkItem).toHaveBeenCalledTimes(2)
        expect(decisions.getWorkItem).toHaveBeenNthCalledWith(2, "user-1", "ws-1", "item-1")
        expect(engine.runQueuedItem).toHaveBeenCalledWith(ctx, "item-1")
        expect(engine.runQueued).not.toHaveBeenCalled()
    })
    it("continues draining when another worker completed the item before the reread", async () => {
        const { service, decisions, engine } = await build({ item: queuedOf() })
        engine.runQueuedItem.mockResolvedValue(null)
        decisions.getWorkItem.mockResolvedValueOnce(queuedOf()).mockResolvedValueOnce(queuedOf({ status: "done" }))
        await expect(service.runQueued("user-1", "ws-1", "item-1", "en", "retry")).resolves.toBeUndefined()
        expect(decisions.getWorkItem).toHaveBeenCalledTimes(2)
        expect(decisions.getWorkItem).toHaveBeenNthCalledWith(2, "user-1", "ws-1", "item-1")
        expect(engine.runQueuedItem).toHaveBeenCalledWith(ctx, "item-1")
        expect(engine.runQueued).toHaveBeenCalledWith(ctx, 3)
    })
})
