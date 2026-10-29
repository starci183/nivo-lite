import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { LeadDecisionRecord } from "./decision-history.contracts"
import type { DecisionEntry, EvidenceEntry, WorkContext } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { DecisionEntity } from "./persistence/entities"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"

const INSERTED = { identifiers: [], generatedMaps: [], raw: [] }

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
    decidedByMemberId: "member-1",
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

        it("names the member who decided", async () => {
            const em = mockEntityManager({ insert: [DecisionEntity, INSERTED] })
            const { service } = await build(em)

            await service.decide(ctx, decisionOf({ before: null, decided_by_member_id: "member-1" }))

            expect(em.insert.mock.calls[0]?.[1]).toMatchObject({ decidedByMemberId: "member-1" })
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
})

describe("EvidenceService", () => {
    describe("decide", () => {
        it("appends the decision with the proposals as jsonb", async () => {
            const em = mockEntityManager({ insert: [DecisionEntity, INSERTED] })
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

            expect(em.insert).toHaveBeenCalledWith(DecisionEntity, {
                workspaceId: "ws-1",
                workItemId: "item-1",
                leadId: "lead-1",
                department: "sales",
                action: "send_follow_up",
                decidedBy: "An",
                deciderKind: "owner",
                outcome: "approved",
                reason: "over_authority",
                note: "ok",
                before: proposal,
                after: { ...proposal, draft: "Hi" },
                decidedByMemberId: null,
            })
        })

        it("writes null for what the caller left out", async () => {
            const em = mockEntityManager({ insert: [DecisionEntity, INSERTED] })
            const { service } = await build(em)

            await expect(service.decide(ctx, decisionOf({ before: null }))).resolves.toBeUndefined()

            expect(em.insert).toHaveBeenCalledWith(DecisionEntity, {
                workspaceId: "ws-1",
                workItemId: "item-1",
                leadId: "lead-1",
                department: "sales",
                action: "send_follow_up",
                decidedBy: "An",
                deciderKind: "owner",
                outcome: "approved",
                reason: null,
                note: null,
                before: null,
                after: null,
                decidedByMemberId: null,
            })
        })
    })
})

describe("EvidenceService", () => {
    describe("listDecisions", () => {
        it("answers the history of a customer, oldest first when asked", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawMany: [recordOf()] }])
            const { service } = await build(em)

            await expect(
                service.listDecisions("ws-1", { leadId: "lead-1", limit: 20, oldestFirst: true }),
            ).resolves.toEqual([recordOf()])

            expect(read?.callsOf("where")).toEqual([["d.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
            expect(read?.callsOf("andWhere")).toEqual([["d.leadId = :leadId", { leadId: "lead-1" }]])
            expect(read?.callsOf("orderBy")).toEqual([["d.createdAt", "ASC"]])
            expect(read?.callsOf("addOrderBy")).toEqual([["d.id", "ASC"]])
            expect(read?.callsOf("limit")).toEqual([[20]])
        })

        it("filters one department's human decisions, newest first", async () => {
            const em = mockEntityManager()
            const [read] = queueQueryBuilders(em, [{ getRawMany: [] }])
            const { service } = await build(em)

            await expect(service.listDecisions("ws-1", { humanDepartment: "sales", limit: 5 })).resolves.toEqual([])

            expect(read?.callsOf("andWhere")).toEqual([
                ["d.department = :department AND d.deciderKind IN ('owner', 'staff')", { department: "sales" }],
            ])
            expect(read?.callsOf("orderBy")).toEqual([["d.createdAt", "DESC"]])
        })

        it("keeps the page between one and a thousand whole rows", async () => {
            const em = mockEntityManager()
            const [big, small] = queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
            const { service } = await build(em)

            await expect(service.listDecisions("ws-1", { humanDepartment: "sales", limit: 5000 })).resolves.toEqual([])
            await expect(service.listDecisions("ws-1", { limit: 0.4 })).resolves.toEqual([])

            expect(big?.callsOf("limit")).toEqual([[1000]])
            expect(small?.callsOf("limit")).toEqual([[1]])
            expect(small?.callsOf("andWhere")).toEqual([])
        })
    })

    describe("listAccounting", () => {
        it("answers the newest accounting decisions, five hundred by default", async () => {
            const em = mockEntityManager()
            const [first, second] = queueQueryBuilders(em, [{ getRawMany: [] }, { getRawMany: [] }])
            const { service } = await build(em)

            await expect(service.listAccounting("ws-1")).resolves.toEqual([])
            await expect(service.listAccounting("ws-1", 10)).resolves.toEqual([])

            expect(first?.callsOf("limit")).toEqual([[500]])
            expect(second?.callsOf("limit")).toEqual([[10]])
            expect(first?.callsOf("where")).toEqual([
                ["d.workspaceId = :workspaceId AND d.department = 'accounting'", { workspaceId: "ws-1" }],
            ])
            expect(first?.callsOf("orderBy")).toEqual([["d.createdAt", "DESC"]])
            expect(first?.callsOf("addOrderBy")).toEqual([["d.id", "DESC"]])
        })
    })
})
