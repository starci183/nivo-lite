import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { IsNull } from "typeorm"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    DIRECTORY,
    HA_REF,
    IN_30_MINUTES,
    MINH_REF,
    NOW,
    approvalRequestEntityOf,
    requestOfSecondStep,
    allApproveRequestMinhApproved,
} from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import type { ApprovalRequestRecord, ApprovalResolved } from "./approval-requests.contracts"
import { toRequestRecord } from "./approval-requests.mapper"
import { ApprovalSweepService } from "./approval-sweep.service"
import { ApprovalRequestEntity } from "./persistence/entities"

const expiredOf = (row: ApprovalRequestRecord): ApprovalResolved => ({
    requestId: row.id,
    outcome: "expired",
    decidedBy: null,
    decidedByName: null,
    action: row.action,
    workspaceId: row.workspace_id,
    chainStepId: row.chain_step_id,
    escalatedTo: MINH_REF,
})

/** Builds the sweep over the reads it will make, in order: what is due, then what is remindable. */
const build = async (
    due: ReadonlyArray<ApprovalRequestEntity>,
    remindable: ReadonlyArray<ApprovalRequestEntity> = [],
) => {
    const tx = fakeTransaction(mockEntityManager({ update: [ApprovalRequestEntity, { affected: 1 }] }))
    const fakes = queueQueryBuilders(tx.em, [{ getMany: due }, { getMany: remindable }])
    const grants = mock<MemberGrantsService>()
    grants.directory.mockResolvedValue(DIRECTORY)
    const escalation = mock<ApprovalEscalationService>()
    escalation.expire.mockImplementation((...args) => Promise.resolve(expiredOf(args[1])))
    const announcer = mock<ApprovalAnnouncerService>()
    announcer.resolved.mockResolvedValue(undefined)
    announcer.reminder.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApprovalSweepService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MemberGrantsService, useValue: grants },
            { provide: ApprovalEscalationService, useValue: escalation },
            { provide: ApprovalAnnouncerService, useValue: announcer },
        ],
    }).compile()
    return { service: moduleRef.get(ApprovalSweepService), tx, fakes, grants, escalation, announcer }
}

describe("ApprovalSweepService > requests that ran out of time", () => {
    it("settles each one as expired through the escalation and announces it after the commit", async () => {
        const first = approvalRequestEntityOf({ expiresAt: new Date("2026-10-22T09:29:00.000Z") })
        const { service, tx, fakes, announcer } = await build([first])

        await expect(service.sweep()).resolves.toEqual({ expired: 1, reminded: 0 })

        expect(fakes[0]?.callsOf("where")).toEqual([
            ["r.status = 'pending' AND r.expiresAt <= :now", { now: new Date(NOW) }],
        ])
        expect(fakes[0]?.callsOf("limit")).toEqual([[50]])
        expect(fakes[0]?.callsOf("setLock")).toEqual([["pessimistic_write"]])
        expect(fakes[0]?.callsOf("setOnLocked")).toEqual([["skip_locked"]])
        expect(announcer.resolved.mock.calls.map((call) => call[0])).toEqual([expiredOf(toRequestRecord(first))])
        expect(tx.commits).toBe(2)
    })

    it("reads each workspace directory once for the requests of that workspace", async () => {
        const rows = [approvalRequestEntityOf(), requestOfSecondStep()]
        const { service, grants, escalation } = await build(rows)

        await expect(service.sweep()).resolves.toEqual({ expired: 2, reminded: 0 })

        expect(grants.directory).toHaveBeenCalledTimes(1)
        expect(escalation.expire).toHaveBeenCalledTimes(2)
    })

    it("does nothing when nothing ran out of time", async () => {
        const { service, announcer } = await build([])

        await expect(service.sweep()).resolves.toEqual({ expired: 0, reminded: 0 })
        expect(announcer.resolved).not.toHaveBeenCalled()
    })
})

describe("ApprovalSweepService > requests half-way through their time", () => {
    it("reminds once the approvers who have not answered and marks the request reminded", async () => {
        const row = allApproveRequestMinhApproved()
        const { service, tx, fakes, announcer } = await build([], [row])

        await expect(service.sweep()).resolves.toEqual({ expired: 0, reminded: 1 })

        expect(fakes[1]?.callsOf("setOnLocked")).toEqual([["skip_locked"]])
        expect(tx.em.update).toHaveBeenCalledWith(
            ApprovalRequestEntity,
            { id: "request-1", remindedAt: IsNull() },
            { remindedAt: new Date(NOW) },
        )
        expect(announcer.reminder.mock.calls.map((call) => call[0])).toEqual([
            {
                requestId: "request-1",
                workspaceId: "ws-1",
                chainStepId: "step-1",
                action: "give_discount",
                remaining: [HA_REF],
                expiresAt: IN_30_MINUTES,
            },
        ])
    })
})
