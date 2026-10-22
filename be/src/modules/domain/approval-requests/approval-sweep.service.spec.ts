import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    DIRECTORY,
    HA_REF,
    IN_30_MINUTES,
    MINH_REF,
    NOW,
    requestOf,
    verdictOf,
} from "@tests/fixtures/builders/approval-requests.builder"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import type { ApprovalResolved } from "./approval-requests.contracts"
import { ApprovalSweepService } from "./approval-sweep.service"
import type { ApprovalRequestRow } from "./persistence/approval-requests.rows"
import {
    LIST_VERDICTS,
    LOCK_DUE_REQUESTS,
    LOCK_REMINDABLE_REQUESTS,
    MARK_REMINDED,
} from "./persistence/approval-requests.sql"

const expiredOf = (row: ApprovalRequestRow): ApprovalResolved => ({
    requestId: row.id,
    outcome: "expired",
    decidedBy: null,
    decidedByName: null,
    action: row.action,
    workspaceId: row.workspace_id,
    chainStepId: row.chain_step_id,
    escalatedTo: MINH_REF,
})

/** What the double answers to one statement. */
type Answer = readonly [string, unknown]

/** Builds the sweep over the statements it will make, in order: what is due, then what is remindable. */
const build = async (due: ReadonlyArray<ApprovalRequestRow>, remindable: ReadonlyArray<ApprovalRequestRow> = []) => {
    const reminders: ReadonlyArray<Answer> = remindable.flatMap((): ReadonlyArray<Answer> => [
        [LIST_VERDICTS, [verdictOf()]],
        [MARK_REMINDED, []],
    ])
    const answers: ReadonlyArray<Answer> = [
        [LOCK_DUE_REQUESTS, due],
        [LOCK_REMINDABLE_REQUESTS, remindable],
        ...reminders,
    ]
    const tx = fakeTransaction(mockEntityManager({ query: answers }))
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
    return { service: moduleRef.get(ApprovalSweepService), tx, grants, escalation, announcer }
}

describe("ApprovalSweepService > requests that ran out of time", () => {
    it("settles each one as expired through the escalation and announces it after the commit", async () => {
        const first = requestOf({ expires_at: "2026-10-22T09:29:00.000Z" })
        const { service, tx, announcer } = await build([first])

        await expect(service.sweep()).resolves.toEqual({ expired: 1, reminded: 0 })

        expect(tx.em.query).toHaveBeenNthCalledWith(1, LOCK_DUE_REQUESTS, [NOW, 50])
        expect(announcer.resolved.mock.calls.map((call) => call[0])).toEqual([expiredOf(first)])
        expect(tx.commits).toBe(2)
    })

    it("reads each workspace directory once for the requests of that workspace", async () => {
        const rows = [requestOf(), requestOf({ id: "request-2", chain_step_id: "step-2" })]
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
        const row = requestOf({ policy: "all", approvers: [MINH_REF, HA_REF] })
        const { service, tx, announcer } = await build([], [row])

        await expect(service.sweep()).resolves.toEqual({ expired: 0, reminded: 1 })

        expect(tx.em.query).toHaveBeenCalledWith(MARK_REMINDED, ["request-1", NOW])
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
