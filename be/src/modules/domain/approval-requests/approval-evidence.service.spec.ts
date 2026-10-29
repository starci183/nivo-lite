import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HA_REF, MINH_REF } from "@tests/fixtures/builders/approval-requests.builder"
import type { ApprovalReminder, ApprovalResolved } from "./approval-requests.contracts"
import { ApprovalEvidenceService } from "./approval-evidence.service"

const resolvedOf = builder<ApprovalResolved>({
    requestId: "request-1",
    outcome: "approved",
    decidedBy: "member-minh",
    decidedByName: "Anh Minh",
    action: "give_discount",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    escalatedTo: null,
})

const reminderOf = builder<ApprovalReminder>({
    requestId: "request-1",
    workspaceId: "ws-1",
    chainStepId: "step-1",
    action: "give_discount",
    remaining: [HA_REF, { memberId: "member-nam", name: "Nam", role: "staff", roomId: null }],
    expiresAt: "2026-10-22T10:00:00.000Z",
})

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}:${JSON.stringify(params)}`)
    const events = mock<EventsService>()
    events.record.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalEvidenceService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { subject: moduleRef.get(ApprovalEvidenceService), events }
}

describe("ApprovalEvidenceService > resolved", () => {
    it("writes a settled request into the evidence log under the name of the member who settled it", async () => {
        const { subject, events } = await build()

        await expect(subject.resolved(resolvedOf())).resolves.toBeUndefined()

        expect(events.record.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    kind: "approval.resolved",
                    actor: "Anh Minh",
                    summary: 'approvals.resolved-approved:{"action":"give_discount","owner":""}',
                    evidence: JSON.stringify({
                        requestId: "request-1",
                        chainStepId: "step-1",
                        outcome: "approved",
                        decidedBy: "member-minh",
                        escalatedTo: null,
                    }),
                },
            ],
        ])
    })

    it("writes inside the caller's transaction when it hands one", async () => {
        const { subject, events } = await build()
        const tx = mockEntityManager()

        await subject.resolved(resolvedOf(), tx)

        expect(events.record.mock.calls[0]?.[1]).toBe(tx)
    })

    it("writes a rejection with its own line", async () => {
        const { subject, events } = await build()

        await subject.resolved(resolvedOf({ outcome: "rejected" }))

        expect(events.record.mock.calls[0]?.[0]?.summary).toBe(
            'approvals.resolved-rejected:{"action":"give_discount","owner":""}',
        )
    })

    it("writes an expiry as NIVO and names the member the request went to", async () => {
        const { subject, events } = await build()

        await subject.resolved(
            resolvedOf({ outcome: "expired", decidedBy: null, decidedByName: null, escalatedTo: MINH_REF }),
        )

        const entry = events.record.mock.calls[0]?.[0]
        expect(entry?.actor).toBe("NIVO")
        expect(entry?.summary).toBe('approvals.resolved-expired:{"action":"give_discount","owner":"Anh Minh"}')
        expect(entry?.evidence).toContain('"escalatedTo":"member-minh"')
    })

    it("says so when an expired request had nobody to go to", async () => {
        const { subject, events } = await build()

        await subject.resolved(resolvedOf({ outcome: "expired", decidedBy: null, decidedByName: null }))

        expect(events.record.mock.calls[0]?.[0]?.summary).toBe(
            'approvals.resolved-expired-nobody:{"action":"give_discount","owner":""}',
        )
    })
})

describe("ApprovalEvidenceService > reminder", () => {
    it("writes the one reminder with the names of the approvers still awaited", async () => {
        const { subject, events } = await build()

        await subject.reminder(reminderOf())

        expect(events.record.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws-1",
            kind: "approval.reminder",
            actor: "NIVO",
            summary: 'approvals.reminder:{"action":"give_discount","names":"Ha, Nam"}',
            evidence: JSON.stringify({ requestId: "request-1", chainStepId: "step-1" }),
        })
    })
})
