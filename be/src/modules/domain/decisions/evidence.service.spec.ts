import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { LeadDecisionRecord } from "./decision-history.contracts"
import type { DecisionEntry, EvidenceEntry, WorkContext } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { INSERT_DECISION, LIST_ACCOUNTING_DECISIONS } from "./persistence/decision-log.sql"
import { LIST_LEAD_DECISION_HISTORY } from "./persistence/decision-history.sql"

const ctx: WorkContext = { workspaceId: "ws-1", actor: "An", locale: "vi" }

const decisionOf = builder<DecisionEntry>({
    work_item_id: "item-1",
    lead_id: "lead-1",
    department: "sales",
    action: "send_follow_up",
    decided_by: "An",
    decider_kind: "owner",
    outcome: "approved",
})

const recordOf = builder<LeadDecisionRecord>({
    id: "decision-1",
    work_item_id: "item-1",
    lead_id: "lead-1",
    leadName: "Minh",
    department: "sales",
    action: "send_follow_up",
    decided_by: "An",
    decider_kind: "owner",
    outcome: "approved",
    reason: null,
    note: null,
    created_at: "2026-10-12T10:00:00.000Z",
})

const build = async (query: MockEntityManager) => {
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            EvidenceService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: query },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(EvidenceService), events }
}

describe("EvidenceService", () => {
    describe("log", () => {
        it("hands the line to the events capability with the workspace of the context", async () => {
            const em = mockEntityManager()
            const { service, events } = await build(em)
            const entry: EvidenceEntry = {
                lead_id: "lead-1",
                work_item_id: "item-1",
                kind: "core.duplicate_blocked",
                actor: "NIVO",
                summary: "Blocked a duplicate",
                evidence: "tg:1:2",
            }

            await expect(service.log(ctx, entry)).resolves.toBeUndefined()

            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    kind: "core.duplicate_blocked",
                    actor: "NIVO",
                    summary: "Blocked a duplicate",
                    leadId: "lead-1",
                    workItemId: "item-1",
                    evidence: "tg:1:2",
                },
                em,
            )
        })

        it("writes null for what the caller left out", async () => {
            const { service, events } = await build(mockEntityManager())
            const inside = mockEntityManager()

            await expect(
                service.log(ctx, { kind: "authority.updated", actor: "An", summary: "policies" }, inside),
            ).resolves.toBeUndefined()

            expect(events.record).toHaveBeenCalledWith(
                {
                    workspaceId: "ws-1",
                    kind: "authority.updated",
                    actor: "An",
                    summary: "policies",
                    leadId: null,
                    workItemId: null,
                    evidence: null,
                },
                inside,
            )
        })
    })

    describe("decide", () => {
        it("appends the decision with the proposals serialised", async () => {
            const em = mockEntityManager({ query: [INSERT_DECISION, []] })
            const { service } = await build(em)
            const proposal = { summary: "Send", fields: {} }

            await expect(
                service.decide(
                    ctx,
                    decisionOf({
                        reason: "over_authority",
                        note: "ok",
                        before: proposal,
                        after: { ...proposal, draft: "Hi" },
                    }),
                ),
            ).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(INSERT_DECISION, [
                "ws-1",
                "item-1",
                "lead-1",
                "sales",
                "send_follow_up",
                "An",
                "owner",
                "approved",
                "over_authority",
                "ok",
                JSON.stringify(proposal),
                JSON.stringify({ ...proposal, draft: "Hi" }),
            ])
        })

        it("writes null for what the caller left out", async () => {
            const em = mockEntityManager({ query: [INSERT_DECISION, []] })
            const { service } = await build(em)

            await expect(service.decide(ctx, decisionOf({ before: null }))).resolves.toBeUndefined()

            expect(em.query).toHaveBeenCalledWith(INSERT_DECISION, [
                "ws-1",
                "item-1",
                "lead-1",
                "sales",
                "send_follow_up",
                "An",
                "owner",
                "approved",
                null,
                null,
                null,
                null,
            ])
        })
    })

    describe("listDecisions", () => {
        it("answers the history of a customer, oldest first when asked", async () => {
            const em = mockEntityManager({ query: [LIST_LEAD_DECISION_HISTORY, [recordOf()]] })
            const { service } = await build(em)

            await expect(
                service.listDecisions("ws-1", { leadId: "lead-1", limit: 20, oldestFirst: true }),
            ).resolves.toEqual([recordOf()])
            expect(em.query).toHaveBeenCalledWith(LIST_LEAD_DECISION_HISTORY, ["ws-1", "lead-1", null, true, 20])
        })

        it("keeps the page between one and a thousand whole rows", async () => {
            const em = mockEntityManager({ query: [LIST_LEAD_DECISION_HISTORY, []] })
            const { service } = await build(em)

            await expect(service.listDecisions("ws-1", { humanDepartment: "sales", limit: 5000 })).resolves.toEqual([])
            await expect(service.listDecisions("ws-1", { limit: 0.4 })).resolves.toEqual([])

            expect(em.query.mock.calls).toEqual([
                [LIST_LEAD_DECISION_HISTORY, ["ws-1", null, "sales", false, 1000]],
                [LIST_LEAD_DECISION_HISTORY, ["ws-1", null, null, false, 1]],
            ])
        })
    })

    describe("listAccounting", () => {
        it("answers the newest accounting decisions, five hundred by default", async () => {
            const em = mockEntityManager({ query: [LIST_ACCOUNTING_DECISIONS, []] })
            const { service } = await build(em)

            await expect(service.listAccounting("ws-1")).resolves.toEqual([])
            await expect(service.listAccounting("ws-1", 10)).resolves.toEqual([])

            expect(em.query.mock.calls).toEqual([
                [LIST_ACCOUNTING_DECISIONS, ["ws-1", 500]],
                [LIST_ACCOUNTING_DECISIONS, ["ws-1", 10]],
            ])
        })
    })
})
