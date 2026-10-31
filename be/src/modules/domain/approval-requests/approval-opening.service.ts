import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AuthorityRulesService, appliesToAgent, bandOf } from "@modules/domain/authority-rules"
import type { ApprovalSetup } from "@modules/domain/authority-rules"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    ApprovalRequestRecord,
    ApprovalResolved,
    OpenApprovalParams,
    OpenedApproval,
    OpenWrite,
} from "./approval-requests.contracts"
import { toRequestRecord } from "./approval-requests.mapper"
import { ApprovalAnnouncerService } from "./approval-announcer.service"
import { ApprovalEscalationService } from "./approval-escalation.service"
import { resolveApprovers } from "./approver-set.policy"
import { ApprovalRequestsError, ApprovalRequestsErrorCode } from "./errors/approval-requests.error"
import { ApprovalRequestEntity } from "./persistence/entities"

const MINUTE_MS = 60_000

/** The columns the insert answers, named as the entity properties so the answer reads as an entity. */
const RETURNED = [
    "id",
    'workspace_id AS "workspaceId"',
    'chain_step_id AS "chainStepId"',
    "department",
    "action",
    "amount::float8 AS amount",
    "unit",
    'requested_by_agent_id AS "requestedByAgentId"',
    "policy",
    "status",
    "approvers",
    "excluded",
    "verdicts",
    'timeout_minutes AS "timeoutMinutes"',
    'expires_at AS "expiresAt"',
    'reminded_at AS "remindedAt"',
    'resolved_by AS "resolvedBy"',
    'resolved_at AS "resolvedAt"',
    'escalated_to AS "escalatedTo"',
    'approver_group AS "approverGroup"',
    'created_at AS "createdAt"',
].join(", ")

/** True when a RETURNING row names the key of a stored request, the shape the returned columns give it. */
const isApprovalRequestEntity = (value: unknown): value is ApprovalRequestEntity =>
    typeof value === "object" && value !== null && "id" in value && typeof value.id === "string"

/** The rows a write answered. */
const returnedRequests = (raw: unknown): Array<ApprovalRequestEntity> =>
    Array.isArray(raw) ? raw.filter(isApprovalRequestEntity) : []

/** What the write answers: the row to describe, and the event to publish when the request expired at once. */
interface Opened {
    readonly row: ApprovalRequestRecord
    readonly resolved: ApprovalResolved | null
}

const toOpened = (row: ApprovalRequestRecord): OpenedApproval => ({
    requestId: row.id,
    approvers: row.approvers,
    excluded: row.excluded,
    policy: row.policy,
    expiresAt: row.expires_at,
})

/** The rule with the approver of the branch in place of its own group, policy and wait, when the request comes from a branch. */
const withBranch = (setup: ApprovalSetup, params: OpenApprovalParams): ApprovalSetup =>
    params.branch === undefined
        ? setup
        : {
              ...setup,
              group: params.branch.group,
              policy: params.branch.policy,
              timeout_minutes: params.branch.timeoutMinutes,
          }

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
        const setup = withBranch(await this.setupFor(params), params)
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
        // A step has at most one pending request: when one is pending already nothing is inserted and nothing is answered.
        const written = await tx
            .createQueryBuilder(ApprovalRequestEntity, "ar")
            .insert()
            .values({
                workspaceId: params.workspaceId,
                chainStepId: params.chainStepId,
                department: setup.department,
                action: params.action,
                amount: params.amount,
                unit: setup.unit,
                requestedByAgentId: params.requestedByAgentId,
                policy: setup.policy,
                approvers: [...set.approvers],
                excluded: [...set.excluded],
                timeoutMinutes: setup.timeout_minutes,
                approverGroup: params.branch?.group ?? null,
                expiresAt: input.expiresAt,
            })
            .orIgnore()
            .returning(RETURNED)
            .execute()
        const [row] = returnedRequests(written.raw)
        if (row === undefined) {
            const pending = await tx.findOne(ApprovalRequestEntity, {
                where: { chainStepId: params.chainStepId, status: "pending" },
            })
            if (pending === null) throw new ApprovalRequestsError({ code: ApprovalRequestsErrorCode.NotFound })
            return { row: toRequestRecord(pending), resolved: null }
        }
        const inserted = toRequestRecord(row)
        if (set.approvers.length > 0) return { row: inserted, resolved: null }
        const resolved = await this.escalation.expire(tx, inserted, input.directory, input.now)
        await this.announcer.resolved(resolved, tx)
        return { row: { ...inserted, status: "expired" }, resolved }
    }
}
