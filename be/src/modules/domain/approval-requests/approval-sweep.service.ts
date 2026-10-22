import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { ApproverRef, DirectoryMember } from "@modules/domain/member-grants"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import type { ApprovalReminder, ApprovalResolved, ApprovalSweep } from "./approval-requests.contracts"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import type { ApprovalRequestRow, ApprovalVerdictRow } from "./persistence/approval-requests.rows"
import {
    LIST_VERDICTS,
    LOCK_DUE_REQUESTS,
    LOCK_REMINDABLE_REQUESTS,
    MARK_REMINDED,
} from "./persistence/approval-requests.sql"

/** The most requests one tick of the sweep settles or reminds. */
const SWEEP_BATCH = 50

/** One request to remind and the approvers who have not answered it. */
interface Reminder {
    readonly row: ApprovalRequestRow
    readonly remaining: ReadonlyArray<ApproverRef>
}

const reminderOf = (entry: Reminder): ApprovalReminder => ({
    requestId: entry.row.id,
    workspaceId: entry.row.workspace_id,
    chainStepId: entry.row.chain_step_id,
    action: entry.row.action,
    remaining: entry.remaining,
    expiresAt: entry.row.expires_at,
})

@Injectable()
/** The minute tick of the requests: expires the ones whose time ran out and reminds, once, the ones that are half-way. */
export class ApprovalSweepService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly grants: MemberGrantsService,
        private readonly escalation: ApprovalEscalationService,
        private readonly announcer: ApprovalAnnouncerService,
    ) {}

    /**
     * Settles the pending requests that ran out of time as expired, each one going to the owner of its agent, and reminds, once,
     * the approvers of the requests that are half-way through their time. Answers how many it settled and reminded.
     */
    async sweep(): Promise<ApprovalSweep> {
        const expired = await this.expireDue()
        const reminded = await this.remindDue()
        return { expired, reminded }
    }

    private async expireDue(): Promise<number> {
        const now = this.clock.now()
        const resolved = await this.entityManager.transaction(async (tx) => {
            const due = await tx.query<Array<ApprovalRequestRow>>(LOCK_DUE_REQUESTS, [now.toISOString(), SWEEP_BATCH])
            const directories = new Map<string, ReadonlyArray<DirectoryMember>>()
            const events: Array<ApprovalResolved> = []
            await eachInOrder(due, async (row) => {
                const directory = directories.get(row.workspace_id) ?? (await this.grants.directory(row.workspace_id))
                directories.set(row.workspace_id, directory)
                events.push(await this.escalation.expire(tx, row, directory, now))
            })
            return events
        })
        await eachInOrder(resolved, (event) => this.announcer.resolved(event))
        return resolved.length
    }

    private async remindDue(): Promise<number> {
        const now = this.clock.now()
        const reminders = await this.entityManager.transaction(async (tx) => {
            const due = await tx.query<Array<ApprovalRequestRow>>(LOCK_REMINDABLE_REQUESTS, [
                now.toISOString(),
                SWEEP_BATCH,
            ])
            const out: Array<Reminder> = []
            await eachInOrder(due, async (row) => {
                const given = await tx.query<Array<ApprovalVerdictRow>>(LIST_VERDICTS, [row.id])
                const answered = new Set(given.map((one) => one.member_id))
                await tx.query(MARK_REMINDED, [row.id, now.toISOString()])
                out.push({ row, remaining: row.approvers.filter((member) => !answered.has(member.memberId)) })
            })
            return out
        })
        await eachInOrder(reminders, (entry) => this.announcer.reminder(reminderOf(entry)))
        return reminders.length
    }
}
