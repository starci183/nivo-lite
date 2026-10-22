import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityRulesService } from "@modules/domain/authority-rules"
import { MemberGrantsService } from "@modules/domain/member-grants"
import type { DirectoryMember } from "@modules/domain/member-grants"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ApprovalProgress,
    ApprovalResolved,
    ApproverSet,
    DecideApprovalParams,
    Refusal,
} from "./approval-requests.contracts"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { resolveApprovers } from "./approver-set.policy"
import { ApprovalRequestsError, ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import type { ApprovalRequestRow, ApprovalVerdictRow } from "./persistence/approval-requests.rows"
import { INSERT_VERDICT, LIST_VERDICTS, LOCK_REQUEST, RESOLVE_REQUEST } from "./persistence/approval-requests.sql"
import { answererOf, namedGroup, notAnApprover, settledBefore } from "./refusal.policy"
import { judgeVerdict } from "./verdict.policy"

/** What settling a verdict in the transaction answers: the progress and the event to publish, or that the request ran out of time. */
type Settled =
    | { readonly kind: "progress"; readonly progress: ApprovalProgress; readonly resolved: ApprovalResolved | null }
    | { readonly kind: "expired"; readonly resolved: ApprovalResolved }

const refused = (refusal: Refusal): ApprovalRequestsError =>
    new ApprovalRequestsError({ code: refusal.code, params: refusal.params })

@Injectable()
/** Takes the verdict of a member on a request: proves their right again, takes the lock, and lets the policy say whether it settles. */
export class ApprovalDecidingService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly rules: AuthorityRulesService,
        private readonly grants: MemberGrantsService,
        private readonly escalation: ApprovalEscalationService,
        private readonly announcer: ApprovalAnnouncerService,
    ) {}

    /**
     * A member answers a request. The server proves the answer again, whatever the screen showed: the request is locked, the group
     * and the grants are read as they are now, and the member must be among the people they cover for this amount. Then the policy
     * says whether this answer settles the request. A request that ran out of time is settled as expired (and goes to the owner of
     * the agent) and the answer is refused.
     */
    async decide(params: DecideApprovalParams): Promise<ApprovalProgress> {
        const settled = await this.entityManager.transaction((tx) => this.settle(tx, params, this.clock.now()))
        if (settled.resolved !== null) await this.announcer.resolved(settled.resolved)
        if (settled.kind === "expired") throw new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.Expired })
        return settled.progress
    }

    private async settle(tx: EntityManager, params: DecideApprovalParams, now: Date): Promise<Settled> {
        const [row] = await tx.query<Array<ApprovalRequestRow>>(LOCK_REQUEST, [params.requestId])
        if (row === undefined) throw new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.NotFound })
        const directory = await this.grants.directory(row.workspace_id)
        if (row.status !== "pending") throw refused(settledBefore(row, directory))
        if (new Date(row.expires_at).getTime() <= now.getTime()) {
            return { kind: "expired", resolved: await this.escalation.expire(tx, row, directory, now) }
        }
        const eligible = await this.eligibleFor(row, directory)
        const decider = answererOf(params.memberId, eligible)
        if (decider === null) throw refused(notAnApprover(params.memberId, eligible))
        const given = await tx.query<Array<ApprovalVerdictRow>>(LIST_VERDICTS, [row.id])
        const judged = judgeVerdict({
            policy: row.policy,
            eligible: eligible.approvers,
            given: given.map((one) => ({ memberId: one.member_id, verdict: one.verdict })),
            memberId: params.memberId,
            verdict: params.verdict,
        })
        if (judged.kind === "refused") throw new ApprovalRequestsError({ code: judged.code, params: judged.params })
        await tx.query(INSERT_VERDICT, [row.id, params.memberId, params.verdict, now.toISOString()])
        const approvedBy = [
            ...given.filter((one) => one.verdict === "approve").map((one) => one.member_id),
            ...(params.verdict === "approve" ? [params.memberId] : []),
        ]
        if (!judged.value.settled) {
            const progress = { requestId: row.id, status: row.status, approvedBy, remaining: judged.value.remaining }
            return { kind: "progress", progress, resolved: null }
        }
        const outcome = judged.value.outcome
        await tx.query(RESOLVE_REQUEST, [row.id, outcome, params.memberId, now.toISOString(), null])
        return {
            kind: "progress",
            progress: { requestId: row.id, status: outcome, approvedBy, remaining: [] },
            resolved: {
                requestId: row.id,
                outcome,
                decidedBy: params.memberId,
                decidedByName: decider.name,
                action: row.action,
                workspaceId: row.workspace_id,
                chainStepId: row.chain_step_id,
                escalatedTo: null,
            },
        }
    }

    /**
     * The people who may answer a pending request now: the group of its rule as it is now (the people it named when it opened, if
     * the rule is gone) with the grants as they are now, so a member who lost their grant, or the room, no longer can.
     */
    private async eligibleFor(
        row: ApprovalRequestRow,
        directory: ReadonlyArray<DirectoryMember>,
    ): Promise<ApproverSet> {
        const [setup, grants] = await Promise.all([
            this.rules.approvalSetup(row.workspace_id, row.action),
            this.grants.forAction(row.workspace_id, row.action),
        ])
        return resolveApprovers({
            group: setup?.group ?? namedGroup(row),
            directory,
            grants,
            need: { unit: row.unit, amount: row.amount },
        })
    }
}
