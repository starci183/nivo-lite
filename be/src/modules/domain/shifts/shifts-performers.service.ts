import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ActionPerformerRegistry, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ShiftsError, ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsCoverService } from "./shifts-cover.service"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Shift } from "./shifts.contracts"
import { DECIDE_LEAVE, DECIDE_SWAP, PUBLISH_SCHEDULE } from "./persistence/shifts.sql"
import { fieldText } from "./policies/gate-fields.policy"
import { nameOf } from "./policies/labels.policy"
import { toMin } from "./policies/time.policy"

/** Findings that no decision can overrule: the request no longer makes sense. */
const HARD_FINDINGS: ReadonlySet<string> = new Set([
    "shift-missing",
    "not-posted",
    "not-owner",
    "taken",
    "taker-gone",
    "started",
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const hoursOf = (shifts: ReadonlyArray<Shift>): number =>
    Math.round((shifts.reduce((total, shift) => total + toMin(shift.end) - toMin(shift.start), 0) / 60) * 10) / 10

@Injectable()
/** Registers what runs once the gate lets a shifts action through: publishing a schedule, approving a swap, approving leave. */
export class ShiftsPerformersService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly registry: ActionPerformerRegistry,
        private readonly office: OfficeLog,
        private readonly data: ShiftsDataService,
        private readonly words: ShiftsTextService,
        private readonly notify: ShiftsNotifyService,
        private readonly requests: ShiftsRequestsService,
        private readonly cover: ShiftsCoverService,
    ) {}

    /** Hands the three performers to the registry. */
    onModuleInit(): void {
        this.registry.add({
            action: "publish_schedule",
            perform: (context) => this.performPublish(context),
            reject: (context) => this.rejectPublish(context),
        })
        this.registry.add({
            action: "approve_swap",
            perform: (context) => this.performSwap(context),
            reject: (context) => this.rejectSwap(context),
        })
        this.registry.add({
            action: "approve_leave",
            perform: (context) => this.performLeave(context),
            reject: (context) => this.rejectLeave(context),
        })
    }

    /** Publishes a draft schedule: it replaces the week's older one and every person gets their shifts. */
    async performPublish(context: PerformContext): Promise<PerformResult> {
        const { workspaceId } = context
        const schedule = await this.data.scheduleRow(workspaceId, fieldText(context.fields, "schedule_id"))
        if (schedule === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotFound })
        const week = this.words.week(schedule.week_start)
        if (schedule.status === "published") {
            return { summary: this.words.text("shifts.publishAlready", { week }), evidence: "captured" }
        }
        if (schedule.status !== "draft") throw new ShiftsError({ code: ShiftsErrorCode.ScheduleNotDraft })
        const evidence = {
            ...(isRecord(schedule.evidence) ? schedule.evidence : {}),
            publish: { by: context.actor, workItemId: context.workItemId },
        }
        await this.entityManager.query(PUBLISH_SCHEDULE, [
            workspaceId,
            schedule.id,
            JSON.stringify(evidence),
            context.workItemId,
        ])
        const setup = await this.data.loadSetup(workspaceId, false)
        const shifts = (await this.data.scheduleShifts(workspaceId, schedule.id)).filter(
            (shift) => shift.status === "published",
        )
        const byPerson = shifts.reduce(
            (by, shift) =>
                shift.staffId === null ? by : by.set(shift.staffId, [...(by.get(shift.staffId) ?? []), shift]),
            new Map<string, Array<Shift>>(),
        )
        await Promise.all(
            [...byPerson].map(([staffId, own]) =>
                this.notify.toStaff(workspaceId, {
                    staffId,
                    kind: "publish",
                    scheduleId: schedule.id,
                    body: this.words.text("shifts.personalSchedule", {
                        week,
                        count: own.length,
                        hours: hoursOf(own),
                        lines: own.map((shift) => `- ${this.words.line(setup, shift)}`).join("\n"),
                    }),
                }),
            ),
        )
        const open = shifts.filter((shift) => shift.staffId === null)
        if (open.length > 0) {
            await this.notify.toManagers(
                workspaceId,
                this.words.text("shifts.gapOffice", {
                    count: open.length,
                    week,
                    lines: open
                        .slice(0, 4)
                        .map((shift) => this.words.line(setup, shift))
                        .join("; "),
                }),
            )
        }
        await this.office.logEvidence(workspaceId, {
            kind: "shifts.published",
            actor: context.actor,
            summary: this.words.text("shifts.publishEvidence", { week, people: byPerson.size }),
            evidence: JSON.stringify({ scheduleId: schedule.id, shifts: shifts.length, open: open.length }),
            workItemId: context.workItemId,
        })
        return {
            summary: this.words.text("shifts.publishDone", { week, people: byPerson.size }),
            evidence: "captured",
            detail: String(schedule.version),
        }
    }

    /** The owner refused to publish: the draft stays for editing. */
    async rejectPublish(context: PerformContext): Promise<void> {
        await this.office.logEvidence(context.workspaceId, {
            kind: "shifts.publish_declined",
            actor: context.actor,
            summary: this.words.text("shifts.publishDeclined", {
                week: this.words.week(fieldText(context.fields, "week_start")),
            }),
            workItemId: context.workItemId,
        })
    }

    /** Moves a shift to the person who takes it, when the rules still allow it. */
    async performSwap(context: PerformContext): Promise<PerformResult> {
        const { workspaceId } = context
        const request = await this.data.swapRow(workspaceId, fieldText(context.fields, "swap_id"))
        if (request === undefined) throw new ShiftsError({ code: ShiftsErrorCode.ShiftNotFound })
        if (request.status === "approved")
            return { summary: this.words.text("shifts.swapAlready"), evidence: "captured" }
        if (request.status !== "pending") return { summary: this.words.text("shifts.swapHandled"), evidence: "pending" }
        const kind = request.kind === "claim" ? "claim" : "swap"
        const checked = await this.requests.checkSwap(
            workspaceId,
            { kind, fromStaffId: request.from_staff_id, toStaffId: request.to_staff_id },
            request.shift_id,
        )
        const hard = checked.findings.filter((finding) => HARD_FINDINGS.has(finding.code))
        if (hard.length > 0 || checked.shift === undefined) {
            throw new ShiftsError({
                code: ShiftsErrorCode.SwapRefused,
                params: { reasons: this.words.findings(hard).join(" ") },
            })
        }
        const sentences = this.words.findings(checked.findings)
        const [settled] = await this.entityManager.query<Array<{ settled: boolean }>>(DECIDE_SWAP, [
            workspaceId,
            request.id,
            "approved",
            context.actor,
            JSON.stringify(sentences),
            context.workItemId,
        ])
        if (settled?.settled !== true) return { summary: this.words.text("shifts.swapHandled"), evidence: "pending" }
        const line = this.words.line(checked.setup, checked.shift)
        const to = nameOf(checked.setup, request.to_staff_id)
        const kindText = this.words.text(`shifts.swapKind.${kind}`)
        await this.notify.toStaff(workspaceId, {
            staffId: request.to_staff_id,
            kind: "swap",
            shiftId: checked.shift.id,
            body: this.words.text("shifts.swapDoneTo", { line }),
        })
        if (request.from_staff_id !== null) {
            await this.notify.toStaff(workspaceId, {
                staffId: request.from_staff_id,
                kind: "swap",
                shiftId: checked.shift.id,
                body: this.words.text("shifts.swapDoneFrom", { line, to }),
            })
        }
        await this.office.logEvidence(workspaceId, {
            kind: "shifts.swap_approved",
            actor: context.actor,
            summary: this.words.text("shifts.swapEvidence", { kind: kindText, line, to }),
            evidence: sentences.join(" "),
            workItemId: context.workItemId,
        })
        return { summary: this.words.text("shifts.swapApproved", { kind: kindText, line, to }), evidence: "captured" }
    }

    /** The owner refused a swap: the shift stays where it was and the person is told. */
    async rejectSwap(context: PerformContext): Promise<void> {
        const request = await this.openRequest(context, "swap_id", (workspaceId, id) =>
            this.data.swapRow(workspaceId, id),
        )
        if (request === undefined) return
        await this.entityManager.query(DECIDE_SWAP, [
            context.workspaceId,
            request.id,
            "declined",
            context.actor,
            null,
            context.workItemId,
        ])
        await this.notify.toStaff(context.workspaceId, {
            staffId: request.from_staff_id ?? request.to_staff_id,
            kind: "swap",
            body: this.words.text("shifts.swapDeclined"),
        })
    }

    /** Approves leave: the person's shifts in the range become open shifts and the managers see who could cover them. */
    async performLeave(context: PerformContext): Promise<PerformResult> {
        const { workspaceId } = context
        const request = await this.data.leaveRow(workspaceId, fieldText(context.fields, "leave_id"))
        if (request === undefined) throw new ShiftsError({ code: ShiftsErrorCode.StaffNotFound })
        if (request.status === "approved")
            return { summary: this.words.text("shifts.leaveAlready"), evidence: "captured" }
        if (request.status !== "pending")
            return { summary: this.words.text("shifts.leaveHandled"), evidence: "pending" }
        const setup = await this.data.loadSetup(workspaceId, false)
        const name = nameOf(setup, request.staff_id)
        const range = this.words.range(request.from_date, request.to_date)
        const [decided] = await this.entityManager.query<Array<{ opened: Array<string> | null }>>(DECIDE_LEAVE, [
            workspaceId,
            request.id,
            "approved",
            context.actor,
            context.workItemId,
            this.words.text("shifts.leaveNote", { name }),
        ])
        const opened = decided?.opened ?? []
        await this.notify.toStaff(workspaceId, {
            staffId: request.staff_id,
            kind: "leave",
            body: this.words.text("shifts.leaveDoneStaff", { range }),
        })
        if (opened.length > 0) {
            const lines = await this.cover.suggestions(workspaceId, opened, request.staff_id)
            await this.notify.toManagers(
                workspaceId,
                this.words.text("shifts.leaveGapOffice", { name, count: opened.length, lines: lines.join("; ") }),
            )
        }
        await this.office.logEvidence(workspaceId, {
            kind: "shifts.leave_approved",
            actor: context.actor,
            summary: this.words.text("shifts.leaveEvidence", { name, range, count: opened.length }),
            evidence: request.id,
            workItemId: context.workItemId,
        })
        return {
            summary: this.words.text("shifts.leaveApproved", { name, count: opened.length }),
            evidence: "captured",
        }
    }

    /** The owner refused leave: the person keeps their shifts and is told. */
    async rejectLeave(context: PerformContext): Promise<void> {
        const request = await this.openRequest(context, "leave_id", (workspaceId, id) =>
            this.data.leaveRow(workspaceId, id),
        )
        if (request === undefined) return
        const range = this.words.range(request.from_date, request.to_date)
        await this.entityManager.query(DECIDE_LEAVE, [
            context.workspaceId,
            request.id,
            "declined",
            context.actor,
            context.workItemId,
            "",
        ])
        await this.notify.toStaff(context.workspaceId, {
            staffId: request.staff_id,
            kind: "leave",
            body: this.words.text("shifts.leaveDeclined", { range }),
        })
    }

    /** A pending request of one field, or nothing when it is missing or already settled. */
    private async openRequest<T extends { readonly status: string }>(
        context: PerformContext,
        field: string,
        load: (workspaceId: string, id: string) => Promise<T | undefined>,
    ): Promise<T | undefined> {
        const request = await load(context.workspaceId, fieldText(context.fields, field))
        return request?.status === "pending" ? request : undefined
    }
}
