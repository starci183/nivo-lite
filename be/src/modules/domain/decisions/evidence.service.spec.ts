import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { EventsService } from "@modules/domain/events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { DecisionEntry, EvidenceEntry, WorkContext } from "./decisions.contracts"
import { EvidenceService } from "./evidence.service"
import { DecisionEntity } from "./persistence/entities"

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
