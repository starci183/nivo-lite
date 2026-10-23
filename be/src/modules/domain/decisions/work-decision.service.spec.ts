import { itemOf } from "../../../tests/fixtures/builders/work-decision.builder"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { ExecutionsService } from "@modules/domain/executions"
import type { ExecutionRecordRow, ExecutionRow } from "@modules/domain/executions"
import { MessagesService } from "@modules/domain/messages"
import { ResponsibilityJournalService } from "@modules/domain/responsibilities"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import { CLAIM_LEASE_SECONDS } from "@modules/domain/work-items"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { Decider, WorkItem } from "./decisions.contracts"
import { CommandBusService } from "./command-bus.service"
import { DecisionsService } from "./decisions.service"
import { DecisionsErrorCode } from "./errors/decisions.error"
import { EvidenceService } from "./evidence.service"
import type { ExecutionDecisionRequest, WorkDecisionRequest } from "./work-decision.contracts"
import { WorkDecisionService } from "./work-decision.service"
import { LEAD_DIRECTORY } from "./work-engine.decorators"
import type { LeadDirectory } from "./work-engine.port"
import { WorkEngineService } from "./work-engine.service"

const anything = (): unknown => expect.anything()
const memberOf = builder<WorkspaceMember>({
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
})
const cardOf = builder<ExecutionRow>({
    id: "exec-1",
    status: "pending_approval",
    work_item_id: "item-1",
    draft: "Hello",
})
const requestOf = builder<WorkDecisionRequest>({
    workItemId: "item-1",
    decision: "approved",
    edits: {},
    note: null,
    basis: null,
    locale: "en",
})
const cardRequestOf = builder<ExecutionDecisionRequest>({
    executionId: "exec-1",
    decision: "approved",
    editedDraft: null,
    locale: "en",
})
const recordOf = builder<ExecutionRecordRow>({
    id: "exec-1",
    status: "pending_approval",
    work_item_id: null,
    draft: "Hello",
    workspace_id: "ws-1",
    responsibility_id: "resp-1",
    agent_id: null,
    kind: "follow_up",
    decided_by: null,
    decided_at: null,
    created_at: "2026-10-12T10:00:00.000Z",
})
const responsibilityOf = builder<ResponsibilityRecord>({
    id: "resp-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    title: "Follow up",
    owner_kind: "agent",
    owner_agent_id: null,
    owner_member_id: null,
    owner_name: "Sales",
    next_action: "",
    due_at: null,
    status: "waiting_approval",
    created_at: "2026-10-12T10:00:00.000Z",
})
interface Setup {
    readonly member?: WorkspaceMember
    readonly item?: WorkItem
    readonly card?: ExecutionRow | null
    readonly settled?: ExecutionRow | null
    readonly record?: ExecutionRecordRow | null
    readonly responsibility?: ResponsibilityRecord | null
}
const build = async (setup: Setup = {}) => {
    const done = itemOf({ status: "done" })
    const require = jest.fn().mockResolvedValue(setup.member ?? memberOf())
    const getWorkItem = jest.fn().mockResolvedValue(setup.item ?? itemOf())
    const resumeWork = jest.fn().mockResolvedValue(done)
    const find = jest.fn().mockResolvedValue(setup.card === undefined ? cardOf() : setup.card)
    const settle = jest.fn().mockResolvedValue(setup.settled === undefined ? null : setup.settled)
    const log = jest.fn().mockResolvedValue(undefined)
    const sendCommand = jest.fn().mockResolvedValue({ ok: true })
    const findRecord = jest.fn().mockResolvedValue(setup.record === undefined ? recordOf() : setup.record)
    const tx = fakeTransaction(mockEntityManager())
    const responsibilities = mock<ResponsibilityJournalService>()
    responsibilities.find.mockResolvedValue(
        setup.responsibility === undefined ? responsibilityOf() : setup.responsibility,
    )
    responsibilities.setStatus.mockResolvedValue(undefined)
    const leads = mock<LeadDirectory>()
    leads.require.mockResolvedValue({ id: "lead-1", contact_name: "Minh", channel: "zalo" })
    const office = mock<MessagesService>()
    office.postSystem.mockResolvedValue(undefined)
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string) => `${key}()`) })
    const members = mock<WorkspaceMembersService>({ require, idOf: jest.fn().mockResolvedValue("member-1") })
    const bus = mock<CommandBusService>({ sendCommand })
    const decisions = mock<DecisionsService>({ getWorkItem })
    const engine = mock<WorkEngineService>({ resumeWork })
    engine.runQueuedItem.mockResolvedValue(done)
    engine.runQueued.mockResolvedValue(3)
    const executions = mock<ExecutionsService>({ find, findRecord, settle })
    const evidence = mock<EvidenceService>({ log })
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkDecisionService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CommandBusService, useValue: bus },
            { provide: DecisionsService, useValue: decisions },
            { provide: WorkEngineService, useValue: engine },
            { provide: ExecutionsService, useValue: executions },
            { provide: EvidenceService, useValue: evidence },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: ResponsibilityJournalService, useValue: responsibilities },
            { provide: LEAD_DIRECTORY, useValue: leads },
            { provide: MessagesService, useValue: office },
        ],
    }).compile()
    return {
        service: moduleRef.get(WorkDecisionService),
        resumeWork,
        find,
        settle,
        log,
        done,
        sendCommand,
        require,
        tx,
        responsibilities,
        office,
        members,
        decisions,
        engine,
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

describe("WorkDecisionService", () => {
    describe("decideExecution", () => {
        it("decides the work item behind the card and settles the card", async () => {
            const settled = cardOf({ status: "approved" })
            const { service, resumeWork, settle } = await build({ settled })
            expect(await service.decideExecution("user-1", "ws-1", cardRequestOf())).toBe(settled)
            expect(resumeWork).toHaveBeenCalledWith(ctx, "item-1", "approved", {}, owner, null)
            expect(settle).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                executionId: "exec-1",
                decision: "approved",
                decidedBy: "An",
                editedDraft: null,
            })
        })
        it("passes edits to the work and answers decided when the engine settled it", async () => {
            const { service, resumeWork } = await build()
            const result = await service.decideExecution("user-1", "ws-1", cardRequestOf({ editedDraft: "Edited" }))
            expect(result).toEqual({ id: "exec-1", status: "approved", work_item_id: "item-1", draft: "Edited" })
            expect(resumeWork).toHaveBeenCalledWith(ctx, "item-1", "approved", { draft: "Edited" }, owner, null)
        })
        it("decides a card when the request names no draft at all", async () => {
            const { service, resumeWork } = await build()
            await service.decideExecution("user-1", "ws-1", {
                executionId: "exec-1",
                decision: "approved",
                locale: "en",
            })
            expect(resumeWork).toHaveBeenCalledWith(ctx, "item-1", "approved", {}, owner, null)
        })
        it("answers the stored draft of a card rejected without edits", async () => {
            const { service } = await build()
            const result = await service.decideExecution("user-1", "ws-1", cardRequestOf({ decision: "rejected" }))
            expect(result).toEqual({ id: "exec-1", status: "rejected", work_item_id: "item-1", draft: "Hello" })
        })
        it("is not found when the card does not exist or its legacy record is gone", async () => {
            const missing = await build({ card: null })
            const legacy = await build({ card: cardOf({ work_item_id: null }), record: null })
            await expect(missing.service.decideExecution("user-1", "ws-1", cardRequestOf())).rejects.toThrow(
                DecisionsErrorCode.NotFound,
            )
            await expect(legacy.service.decideExecution("user-1", "ws-1", cardRequestOf())).rejects.toThrow(
                DecisionsErrorCode.NotFound,
            )
        })
        it("refuses a card that was decided already", async () => {
            const { service, resumeWork } = await build({ card: cardOf({ status: "approved" }) })
            await expect(service.decideExecution("user-1", "ws-1", cardRequestOf())).rejects.toThrow(
                DecisionsErrorCode.NotWaiting,
            )
            expect(resumeWork).not.toHaveBeenCalled()
        })
    })
})

describe("WorkDecisionService", () => {
    describe("decideExecution of a legacy card", () => {
        const legacyCard = cardOf({ work_item_id: null })
        it("saves the edited legacy draft with the decision in the transaction", async () => {
            const settled = cardOf({ status: "approved", work_item_id: null, draft: "Edited legacy" })
            const { service, settle, tx } = await build({ card: legacyCard, settled })
            await expect(
                service.decideExecution("user-1", "ws-1", cardRequestOf({ editedDraft: "Edited legacy" })),
            ).resolves.toBe(settled)
            expect(settle).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    executionId: "exec-1",
                    decision: "approved",
                    decidedBy: "An",
                    editedDraft: "Edited legacy",
                },
                anything(),
            )
            expect(tx.commits).toBe(1)
        })

        it("settles the card, closes the responsibility, logs and posts the decision in one transaction", async () => {
            const settled = cardOf({ status: "approved", work_item_id: null, draft: "Hi Minh" })
            const { service, tx, responsibilities, log, office, resumeWork } = await build({
                card: legacyCard,
                settled,
            })
            await expect(service.decideExecution("user-1", "ws-1", cardRequestOf())).resolves.toBe(settled)
            expect(tx.commits).toBe(1)
            expect(resumeWork).not.toHaveBeenCalled()
            expect(responsibilities.setStatus).toHaveBeenCalledWith(ctx, "resp-1", "done", anything())
            expect(log).toHaveBeenCalledWith(
                ctx,
                {
                    lead_id: "lead-1",
                    kind: "execution.approved",
                    actor: "An",
                    summary: "legacy.approvedEvent()",
                    evidence: "Hi Minh",
                },
                anything(),
            )
            expect(office.postSystem).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                leadId: "lead-1",
                manager: anything(),
                body: "legacy.approvedMessage()",
            })
        })

        it("reopens the responsibility of a rejected card and logs no draft", async () => {
            const settled = cardOf({ status: "rejected", work_item_id: null })
            const { service, responsibilities, log } = await build({ card: legacyCard, settled })
            await expect(
                service.decideExecution("user-1", "ws-1", cardRequestOf({ decision: "rejected" })),
            ).resolves.toBe(settled)
            expect(responsibilities.setStatus).toHaveBeenCalledWith(ctx, "resp-1", "open", anything())
            expect(log).toHaveBeenCalledWith(
                ctx,
                expect.objectContaining({ kind: "execution.rejected", evidence: null }),
                anything(),
            )
        })

        it("lets only an owner or a manager decide it", async () => {
            const { service, tx } = await build({ card: legacyCard, member: memberOf({ role: "staff" }) })
            await expect(service.decideExecution("user-1", "ws-1", cardRequestOf())).rejects.toMatchObject({
                code: DecisionsErrorCode.NotAllowed,
            })
            expect(tx.outcomes).toEqual([])
        })
    })
})

describe("WorkDecisionService", () => {
    describe("decideExecution of a legacy card", () => {
        const legacyCard = cardOf({ work_item_id: null })
        it.each([
            {
                name: "a record decided meanwhile",
                setup: { record: recordOf({ status: "approved" }) },
                code: DecisionsErrorCode.NotWaiting,
            },
            {
                name: "a record that gained a work item",
                setup: { record: recordOf({ work_item_id: "item-1" }) },
                code: DecisionsErrorCode.StateChanged,
            },
            {
                name: "a responsibility that is gone",
                setup: { responsibility: null },
                code: DecisionsErrorCode.NotFound,
            },
            { name: "a card nobody could settle", setup: { settled: null }, code: DecisionsErrorCode.NotWaiting },
        ])("rolls back on $name", async ({ setup, code }) => {
            const { service, tx } = await build({ card: legacyCard, ...setup })
            await expect(service.decideExecution("user-1", "ws-1", cardRequestOf())).rejects.toMatchObject({ code })
            expect(tx.rollbacks).toBe(1)
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
