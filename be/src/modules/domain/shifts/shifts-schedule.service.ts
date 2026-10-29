import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ApprovalGate, ModuleTextGenerator } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager, callDbFunction } from "@modules/platform/database"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Env, Shift, Setup, ViolationKind } from "./shifts.contracts"
import type {
    AddDraftShiftParams,
    ExplainScheduleOutput,
    ExplainScheduleParams,
    ProposeWeekOutput,
    ProposeWeekParams,
    ReassignShiftOutput,
    ReassignShiftParams,
    RemoveDraftShiftParams,
    RequestOutput,
    RequestPublishParams,
} from "./shifts-operations.contracts"
import { ShiftsScheduleEntity, ShiftsShiftEntity } from "./persistence/entities"
import { MANAGER_ROLES } from "./policies/access-roles.policy"
import { coverageOf } from "./policies/coverage.policy"
import { isDay, isTime } from "./policies/input-text.policy"
import { money } from "./policies/labels.policy"
import { solveWeek } from "./policies/solver.policy"
import { mondayOf, toMin } from "./policies/time.policy"
import { violationsOfShifts } from "./policies/work-rules.policy"

/** The finding key of a work-rule break. */
const findingCode = (kind: ViolationKind): string => (kind === "position" ? "position" : `rule-${kind}`)

/** How long the solver may search, and from how many seeded starts. */
const SOLVER_BUDGET_MS = 800
const SOLVER_STARTS = 6
/** How long the explanation may take before the plain one is used. */
const EXPLAIN_TIMEOUT_MS = 15_000

@Injectable()
/** Building, editing and publishing the weekly schedule: the solver builds the draft, a manager edits it, the owner approves the publishing. */
export class ShiftsScheduleService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly members: WorkspaceMembersService,
        private readonly data: ShiftsDataService,
        private readonly words: ShiftsTextService,
        private readonly generator: ModuleTextGenerator,
        private readonly gate: ApprovalGate,
    ) {}

    /** Builds a draft schedule for a week from the setup, the availability and the leave. */
    async proposeWeek(userId: string, workspaceId: string, request: ProposeWeekParams): Promise<ProposeWeekOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        if (!isDay(request.week)) throw new ShiftsError({ code: ShiftsErrorCode.WeekInvalid })
        const monday = mondayOf(request.week)
        const setup = await this.data.loadSetup(workspaceId, true)
        if (!setup.staff.some((person) => person.active)) throw new ShiftsError({ code: ShiftsErrorCode.NoStaff })
        if (setup.blocks.length === 0) throw new ShiftsError({ code: ShiftsErrorCode.NoCoverage })
        const env = await this.data.loadEnv(workspaceId, monday, setup)
        const solved = solveWeek({
            monday,
            staff: setup.staff,
            blocks: setup.blocks,
            avail: env.avail,
            leaves: env.leaves,
            prior: env.prior ?? new Map(),
            overtimeHoursWeek: env.overtimeHoursWeek,
            nowMs: () => this.clock.now().getTime(),
            budgetMs: SOLVER_BUDGET_MS,
            starts: SOLVER_STARTS,
        })
        const cells = coverageOf(setup.blocks, monday, solved.shifts)
        const short = cells.filter((cell) => cell.status === "short").length
        const [saved] = await callDbFunction<{ shifts_save_schedule: string | null }>(
            this.entityManager,
            "public.shifts_save_schedule",
            [
                workspaceId,
                monday,
                Math.round(solved.report.costVnd),
                JSON.stringify({ coverage: cells, hours: solved.report.hoursByStaff }),
                JSON.stringify({ solver: solved.report }),
                Math.round(solved.report.ms),
                displayName,
            ],
        )
        const scheduleId = saved?.shifts_save_schedule
        if (scheduleId === undefined || scheduleId === null)
            throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotSaved })
        await this.addShifts(workspaceId, scheduleId, solved.shifts, "solver")
        const schedule = await this.data.scheduleRow(workspaceId, scheduleId)
        const output: ProposeWeekOutput = {
            scheduleId,
            version: schedule?.version ?? 1,
            shifts: solved.report.shiftCount,
            open: solved.report.openCount,
            short,
            costVnd: Math.round(solved.report.costVnd),
            ms: Math.round(solved.report.ms),
            iterations: solved.report.iterations,
        }
        await this.describe(workspaceId, monday, output)
        return output
    }

    /** Writes the explanation of a schedule again. */
    async explainSchedule(
        userId: string,
        workspaceId: string,
        request: ExplainScheduleParams,
    ): Promise<ExplainScheduleOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const schedule = await this.data.scheduleRow(workspaceId, request.scheduleId)
        if (schedule === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotFound })
        const shifts = await this.data.scheduleShifts(workspaceId, schedule.id)
        const setup = await this.data.loadSetup(workspaceId, false)
        const short = coverageOf(setup.blocks, schedule.weekStart, shifts).filter(
            (cell) => cell.status === "short",
        ).length
        const explanation = await this.describe(workspaceId, schedule.weekStart, {
            scheduleId: schedule.id,
            version: schedule.version,
            shifts: shifts.filter((shift) => shift.staffId !== null).length,
            open: shifts.filter((shift) => shift.staffId === null).length,
            short,
            costVnd: Math.round(Number(schedule.costVnd) || 0),
            ms: 0,
            iterations: 0,
        })
        return { explanation }
    }

    /** Gives a draft shift to another person or opens it. A rule break is a warning, not a refusal. */
    async reassignShift(
        userId: string,
        workspaceId: string,
        request: ReassignShiftParams,
    ): Promise<ReassignShiftOutput> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const row = await this.requireDraftShift(workspaceId, request.shiftId)
        const staffId = request.staffId ?? null
        if (staffId === null) {
            await callDbFunction(this.entityManager, "public.shifts_reassign", [workspaceId, request.shiftId, null])
            return { warnings: [] }
        }
        const setup = await this.data.loadSetup(workspaceId, false)
        if (!setup.staff.some((item) => item.id === staffId && item.active)) {
            throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        }
        await callDbFunction(this.entityManager, "public.shifts_reassign", [workspaceId, request.shiftId, staffId])
        const env = await this.data.loadEnv(workspaceId, row.weekStart, setup)
        const shifts = await this.data.scheduleShifts(workspaceId, row.scheduleId)
        return { warnings: this.warningsOf(setup, env, shifts, request.shiftId, staffId) }
    }

    /** Adds a shift to a draft schedule. */
    async addDraftShift(userId: string, workspaceId: string, request: AddDraftShiftParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const schedule = await this.data.scheduleRow(workspaceId, request.scheduleId)
        if (schedule === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotFound })
        if (schedule.status !== "draft") throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotDraft })
        const validTimes = isTime(request.start) && isTime(request.end) && toMin(request.end) > toMin(request.start)
        if (!isDay(request.date) || !validTimes) throw new ShiftsError({ code: ShiftsErrorCode.TimeInvalid })
        const staffId = request.staffId ?? null
        if (staffId !== null) await this.requireStaff(workspaceId, staffId)
        const shift: Shift = {
            id: "",
            date: request.date,
            start: request.start,
            end: request.end,
            positionId: request.positionId,
            staffId,
            status: "draft",
        }
        await this.addShifts(workspaceId, schedule.id, [shift], "manual")
    }

    /** Removes a shift from a draft schedule. */
    async removeDraftShift(userId: string, workspaceId: string, request: RemoveDraftShiftParams): Promise<void> {
        await this.members.require(userId, workspaceId, MANAGER_ROLES)
        await this.requireDraftShift(workspaceId, request.shiftId)
        await this.entityManager.delete(ShiftsShiftEntity, { id: request.shiftId, workspaceId, status: "draft" })
    }

    /** Puts a draft schedule before the owner; a repeated ask while a decision waits changes nothing. */
    async requestPublish(userId: string, workspaceId: string, request: RequestPublishParams): Promise<RequestOutput> {
        const { displayName } = await this.members.require(userId, workspaceId, MANAGER_ROLES)
        const schedule = await this.data.scheduleRow(workspaceId, request.scheduleId)
        if (schedule === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotFound })
        if (schedule.status !== "draft") throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotDraft })
        const shifts = await this.data.scheduleShifts(workspaceId, schedule.id)
        const attempt =
            (await this.data.askAttempts(workspaceId, "publish_schedule", `publish_schedule:${schedule.id}:`)) + 1
        const verdict = await this.gate.request({
            workspaceId,
            actor: displayName,
            action: "publish_schedule",
            subjectType: "shift_schedule",
            subjectId: schedule.id,
            dedupeKey: `publish_schedule:${schedule.id}:${attempt}`,
            summary: this.words.text("shifts.publishAskSummary", {
                week: this.words.week(schedule.weekStart),
                version: schedule.version,
                shifts: shifts.length,
                open: shifts.filter((shift) => shift.staffId === null).length,
                cost: money(Number(schedule.costVnd) || 0),
            }),
            fields: { schedule_id: schedule.id, week_start: schedule.weekStart },
        })
        if (verdict.status === "waiting_decision") {
            await this.entityManager.update(
                ShiftsScheduleEntity,
                { id: schedule.id, workspaceId },
                { workItemId: verdict.workItemId },
            )
        }
        return { status: verdict.status }
    }

    private async addShifts(
        workspaceId: string,
        scheduleId: string,
        shifts: ReadonlyArray<Shift>,
        source: "solver" | "manual",
    ): Promise<void> {
        if (shifts.length === 0) return
        await callDbFunction(this.entityManager, "public.shifts_add_shifts", [
            workspaceId,
            scheduleId,
            shifts.map((shift) => shift.date),
            shifts.map((shift) => shift.start),
            shifts.map((shift) => shift.end),
            shifts.map((shift) => shift.positionId),
            shifts.map((shift) => shift.staffId),
            source,
        ])
    }

    private async requireDraftShift(workspaceId: string, shiftId: string) {
        const row = await this.data.shiftRow(workspaceId, shiftId)
        if (row === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ShiftNotFound })
        if (row.scheduleStatus !== "draft") throw new ShiftsError({ code: ShiftsErrorCode.ShiftNotEditable })
        return row
    }

    /** The rules the reassigned shift breaks, named for the person who now holds it. */
    private warningsOf(
        setup: Setup,
        env: Env,
        shifts: ReadonlyArray<Shift>,
        shiftId: string,
        staffId: string,
    ): Array<string> {
        const person = setup.staff.find((item) => item.id === staffId)
        const shift = shifts.find((item) => item.id === shiftId)
        const position = setup.positions.find((item) => item.id === shift?.positionId)?.name ?? ""
        const found = violationsOfShifts(env, shifts).get(shiftId) ?? []
        return this.words.findings(
            found.map((item) => ({
                code: findingCode(item.kind),
                params: { name: person?.name ?? "", position },
            })),
        )
    }

    private async requireStaff(workspaceId: string, staffId: string): Promise<void> {
        const setup = await this.data.loadSetup(workspaceId, false)
        if (!setup.staff.some((item) => item.id === staffId && item.active)) {
            throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        }
    }

    /** Stores the explanation of a schedule: the generated one when the model answers in time, the plain one otherwise. */
    private async describe(workspaceId: string, monday: string, facts: ProposeWeekOutput): Promise<string> {
        const params = {
            week: this.words.week(monday),
            version: facts.version,
            shifts: facts.shifts,
            open: facts.open,
            cost: money(facts.costVnd),
            short:
                facts.short === 0
                    ? this.words.text("shifts.explain.shortNone")
                    : this.words.text("shifts.explain.shortSome", { count: facts.short }),
        }
        const written = await this.generator.generate({
            workspaceId,
            purpose: "shifts_explain",
            module: "shifts",
            system: this.words.text("shifts.explain.system"),
            user: this.words.text("shifts.explain.user", params),
            timeoutMs: EXPLAIN_TIMEOUT_MS,
        })
        const text =
            written.ok && written.output.trim() !== ""
                ? written.output.trim()
                : this.words.text("shifts.explain.fallback", params)
        const schedule = await this.data.scheduleRow(workspaceId, facts.scheduleId)
        await this.entityManager.update(
            ShiftsScheduleEntity,
            { id: facts.scheduleId, workspaceId },
            { explanation: text, evidence: schedule?.evidence ?? {} },
        )
        return text
    }
}
