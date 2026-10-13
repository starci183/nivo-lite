import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalGate } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Setup, Shift, SwapFinding } from "./shifts.contracts"
import type { RequestLeaveParams, RequestOutput, RequestSwapParams } from "./shifts-operations.contracts"
import { CREATE_LEAVE, CREATE_SWAP, LINK_LEAVE, LINK_SWAP } from "./persistence/shifts.sql"
import { ANY_MEMBER } from "./policies/access-roles.policy"
import { isDay } from "./policies/input-text.policy"
import { toShift } from "./policies/row-mappers.policy"
import type { SwapAsk } from "./policies/swap-rules.policy"
import { swapFindings } from "./policies/swap-rules.policy"
import { addDays, mondayOf } from "./policies/time.policy"

/** The statuses of shifts that count as someone's work. */
const WORKING: ReadonlyArray<string> = ["draft", "published", "swapped"]
const POSTED: ReadonlyArray<string> = ["published", "swapped"]

/** The answer of a swap check. */
export interface SwapCheckResult {
    /** The shift, or undefined when it does not exist. */
    readonly shift: Shift | undefined
    /** The setup the check ran against. */
    readonly setup: Setup
    /** What breaks. */
    readonly findings: ReadonlyArray<SwapFinding>
}

@Injectable()
/** What a member asks of the schedule: to hand a shift over, to take an open one, or to take leave. The owner decides through the gate. */
export class ShiftsRequestsService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly data: ShiftsDataService,
        private readonly words: ShiftsTextService,
        private readonly gate: ApprovalGate,
    ) {}

    /** Records a swap or a claim, checks it against the rules and puts it before the owner. */
    async requestSwap(userId: string, workspaceId: string, request: RequestSwapParams): Promise<RequestOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, ANY_MEMBER)
        const own = await this.requireProfile(workspaceId, userId)
        const fromStaffId = request.kind === "swap" ? own : null
        const toStaffId = request.kind === "swap" ? request.toStaffId : own
        if (toStaffId === null) throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        const { shift, setup, findings } = await this.checkSwap(
            workspaceId,
            { kind: request.kind, fromStaffId, toStaffId },
            request.shiftId,
        )
        if (shift === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ShiftNotFound })
        const sentences = this.words.findings(findings)
        const [created] = await this.entityManager.query<Array<{ id: string }>>(CREATE_SWAP, [
            workspaceId,
            request.kind,
            shift.id,
            fromStaffId,
            toStaffId,
            request.reason,
        ])
        const swapId = created?.id ?? ""
        const verdict = await this.gate.request({
            workspaceId,
            actor: displayName,
            action: "approve_swap",
            subjectType: "shift_swap",
            subjectId: swapId,
            dedupeKey: `approve_swap:${swapId}`,
            summary: this.words.text("shifts.swapAskSummary", {
                kind: this.words.text(`shifts.swapKind.${request.kind}`),
                line: this.words.line(setup, shift),
                from:
                    fromStaffId === null ? "-" : (setup.staff.find((person) => person.id === fromStaffId)?.name ?? "-"),
                to: setup.staff.find((person) => person.id === toStaffId)?.name ?? "-",
                findings: sentences.length === 0 ? this.words.text("shifts.swapClean") : sentences.join(" "),
            }),
            fields: { swap_id: swapId, clean: sentences.length === 0 },
        })
        await this.entityManager.query(LINK_SWAP, [workspaceId, swapId, JSON.stringify(sentences), verdict.workItemId])
        return { status: verdict.status }
    }

    /** What breaks if the person takes the shift, as sentences, with the shift and the setup the check ran against. */
    async checkSwap(workspaceId: string, ask: SwapAsk, shiftId: string): Promise<SwapCheckResult> {
        const row = await this.data.shiftRow(workspaceId, shiftId)
        const shift = row === undefined ? undefined : toShift(row)
        const monday = mondayOf(shift?.date ?? this.clock.now().toISOString().slice(0, 10))
        const setup = await this.data.loadSetup(workspaceId, false)
        const env = await this.data.loadEnv(workspaceId, monday, setup)
        const mine = await this.data.staffShifts(workspaceId, ask.toStaffId, monday, addDays(monday, 6), POSTED)
        const findings = swapFindings({ ask, shift, setup, env, mine, now: this.clock.now() })
        return { shift, setup, findings }
    }

    /** Records a leave request and puts it before the owner. */
    async requestLeave(userId: string, workspaceId: string, request: RequestLeaveParams): Promise<RequestOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, ANY_MEMBER)
        const own = await this.requireProfile(workspaceId, userId)
        if (!isDay(request.from) || !isDay(request.to) || request.to < request.from) {
            throw new ShiftsError({ code: ShiftsErrorCode.LeaveRangeInvalid })
        }
        const hit = await this.data.staffShifts(workspaceId, own, request.from, request.to, WORKING)
        const [created] = await this.entityManager.query<Array<{ id: string }>>(CREATE_LEAVE, [
            workspaceId,
            own,
            request.from,
            request.to,
            request.reason,
        ])
        const leaveId = created?.id ?? ""
        const reason = request.reason.trim()
        const verdict = await this.gate.request({
            workspaceId,
            actor: displayName,
            action: "approve_leave",
            subjectType: "shift_leave",
            subjectId: leaveId,
            dedupeKey: `approve_leave:${leaveId}`,
            summary: this.words.text("shifts.leaveAskSummary", {
                name: displayName,
                range: this.words.range(request.from, request.to),
                reason: reason === "" ? "" : this.words.text("shifts.leaveReason", { reason }),
                count: hit.length,
            }),
            fields: { leave_id: leaveId },
        })
        await this.entityManager.query(LINK_LEAVE, [workspaceId, leaveId, verdict.workItemId])
        return { status: verdict.status }
    }

    private async requireProfile(workspaceId: string, userId: string): Promise<string> {
        const profile = await this.data.profileOf(workspaceId, userId)
        if (profile === null) throw new ShiftsError({ code: ShiftsErrorCode.ProfileMissing })
        return profile
    }
}
