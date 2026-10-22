import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityRulesService, appliesToAgent, bandOf } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { ApprovalResolved, OpenApprovalParams, OpenedApproval, OpenWrite } from "./approval-requests.contracts"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { resolveApprovers } from "./approver-set.policy"
import { ApprovalRequestsError, ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import type { ApprovalRequestRow } from "./persistence/approval-requests.rows"
import { FIND_PENDING_REQUEST, INSERT_REQUEST } from "./persistence/approval-requests.sql"

const MINUTE_MS = 60_000

/** What the write answers: the row to describe, and the event to publish when the request expired at once. */
interface Opened {
    readonly row: ApprovalRequestRow
    readonly resolved: ApprovalResolved | null
}

const toOpened = (row: ApprovalRequestRow): OpenedApproval => ({
    requestId: row.id,
    approvers: row.approvers,
    excluded: row.excluded,
    policy: row.policy,
    expiresAt: row.expires_at,
})

const isAmount = (amount: number | null): boolean => amount === null || (Number.isFinite(amount) && amount >= 0)

@Injectable()
/** Opens the request of a chain step: who is asked, how they decide and when it runs out. */
export class ApprovalOpeningService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly rules: AuthorityRulesService,
        private readonly grants: MemberGrantsService,
        private readonly escalation: ApprovalEscalationService,
        private readonly announcer: ApprovalAnnouncerService,
    ) {}

    /**
     * Reads the rule of the action, gathers its approver group, keeps the members the grants cover for the amount (the others are
     * listed as excluded with the reason) and starts the clock. A step with a pending request answers that request again. When
     * nobody can approve, the request expires at once and goes to the owner of the agent.
     */
    async open(params: OpenApprovalParams): Promise<OpenedApproval> {
        const setup = await this.setupFor(params)
        const [directory, grants] = await Promise.all([
            this.grants.directory(params.workspaceId),
            this.grants.forAction(params.workspaceId, params.action),
        ])
        const set = resolveApprovers({
            group: setup.group,
            directory,
            grants,
            need: { unit: setup.unit, amount: params.amount },
        })
        const now = this.clock.now()
        const wait = set.approvers.length === 0 ? 0 : setup.timeout_minutes * MINUTE_MS
        const write: OpenWrite = { params, setup, set, directory, now, expiresAt: new Date(now.getTime() + wait) }
        const opened = await this.entityManager.transaction((tx) => this.write(tx, write))
        if (opened.resolved !== null) await this.announcer.resolved(opened.resolved)
        return toOpened(opened.row)
    }

    private async setupFor(params: OpenApprovalParams): Promise<ApprovalSetup> {
        if (!isAmount(params.amount)) throw new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.InvalidAmount })
        const setup = await this.rules.approvalSetup(params.workspaceId, params.action)
        if (setup === null) {
            throw new ApprovalRequestsError({
                code: ApprovalRequestsErrorCode.NoRule,
                params: { action: params.action },
            })
        }
        if (setup.mode === "never" || bandOf(setup, params.amount) === "never") {
            throw new ApprovalRequestsError({
                code: ApprovalRequestsErrorCode.NotApprovable,
                params: { action: params.action },
            })
        }
        if (!appliesToAgent(setup.agents, params.requestedByAgentId)) {
            throw new ApprovalRequestsError({
                code: ApprovalRequestsErrorCode.AgentNotCovered,
                params: { action: params.action },
            })
        }
        if (setup.unit !== params.unit) {
            throw new ApprovalRequestsError({
                code: ApprovalRequestsErrorCode.UnitMismatch,
                params: { unit: setup.unit },
            })
        }
        return setup
    }

    private async write(tx: EntityManager, input: OpenWrite): Promise<Opened> {
        const { params, setup, set } = input
        const [inserted] = await tx.query<Array<ApprovalRequestRow>>(INSERT_REQUEST, [
            params.workspaceId,
            params.chainStepId,
            setup.department,
            params.action,
            params.amount,
            setup.unit,
            params.requestedByAgentId,
            setup.policy,
            JSON.stringify(set.approvers),
            JSON.stringify(set.excluded),
            setup.timeout_minutes,
            input.expiresAt.toISOString(),
        ])
        if (inserted === undefined) {
            const [pending] = await tx.query<Array<ApprovalRequestRow>>(FIND_PENDING_REQUEST, [params.chainStepId])
            if (pending === undefined) throw new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.NotFound })
            return { row: pending, resolved: null }
        }
        if (set.approvers.length > 0) return { row: inserted, resolved: null }
        const resolved = await this.escalation.expire(tx, inserted, input.directory, input.now)
        return { row: { ...inserted, status: "expired" }, resolved }
    }
}
