import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ActionPerformerRegistry, ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectQueueOutbox } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import {
    SHIFTS_NOSHOW_JOB,
    SHIFTS_QUEUE,
    SHIFTS_REMIND_JOB,
    noShowDedupeKey,
    remindDedupeKey,
} from "@modules/queues/shifts"
import type { ShiftAlertPayload } from "@modules/queues/shifts"
import type { AlertShiftRow, EnabledRow, NameRow, ReminderWorkspaceRow } from "./persistence/shifts-alerts.rows"
import {
    SELECT_ALERT_SHIFT,
    SELECT_ALERT_SHIFTS,
    SELECT_DAY_MATES,
    SELECT_REMINDER_ON,
    SELECT_REMINDER_WORKSPACES,
} from "./persistence/shifts-alerts.sql"
import { fieldText } from "./policies/gate-fields.policy"
import { nameOf } from "./policies/labels.policy"
import { shiftsJobOf } from "./policies/shift-jobs.policy"
import type { AlertKind, AlertMinutes, AlertShift } from "./policies/shift-alerts.policy"
import { alertMinutesOf, dueAlerts, minutesLate, shiftWindow, toAlertShift } from "./policies/shift-alerts.policy"
import { addDays, todayVn } from "./policies/time.policy"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsLogEvent } from "./shifts.log-events"

/** Who asks the gate for a reminder, as the log shows it. */
const ACTOR = "NIVO"

/** What one tick queued. */
export interface AlertScan {
    /** Reminders queued. */
    readonly reminders: number
    /** No-show checks queued. */
    readonly noShows: number
}

/** The job name and identity of one due alert. */
interface AlertJob {
    /** The job name. */
    readonly job: string
    /** The identity: one per shift and person. */
    readonly dedupeKey: string
}

/** The verdict line of a reminder by where it reached the person. */
const remindDoneKey = (
    telegram: boolean | null,
    zalo: boolean | null,
): "shifts.remindDoneOffice" | "shifts.remindDoneTelegram" | "shifts.remindDoneZalo" => {
    if (telegram === true) return "shifts.remindDoneTelegram"
    if (zalo === true) return "shifts.remindDoneZalo"
    return "shifts.remindDoneOffice"
}

/** The job name and identity of one due alert. */
const alertJobOf = (kind: AlertKind, shiftId: string, staffId: string): AlertJob =>
    kind === "remind"
        ? { job: SHIFTS_REMIND_JOB, dedupeKey: remindDedupeKey(shiftId, staffId) }
        : { job: SHIFTS_NOSHOW_JOB, dedupeKey: noShowDedupeKey(shiftId, staffId) }

@Injectable()
/**
 * The shift reminders and the no-show alerts (automation `shifts_shift_reminder`). A minute tick finds, per
 * workspace with the automation on, the published shifts whose reminder or no-show check is due and queues one job each (one per shift
 * and person, so a repeat tick queues nothing and a swapped shift reminds its new person). The reminder goes through the authority gate
 * as `remind_shift` and reaches the person in Office and, when linked, on Telegram or Zalo; the no-show alert goes to the managers in
 * Office. Both are re-checked when their job runs, so a shift cancelled, swapped or checked in meanwhile sends nothing.
 */
export class ShiftsAlertsService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
        @InjectLogger() private readonly logger: Logger,
        @InjectClock() private readonly clock: Clock,
        private readonly registry: ActionPerformerRegistry,
        private readonly gate: ApprovalGate,
        private readonly office: OfficeLog,
        private readonly workspaces: WorkspacesService,
        private readonly data: ShiftsDataService,
        private readonly monthClose: ShiftsMonthCloseService,
        private readonly notify: ShiftsNotifyService,
        private readonly words: ShiftsTextService,
    ) {}

    /** Hands the reminder performer to the registry. */
    onModuleInit(): void {
        this.registry.add({
            action: "remind_shift",
            perform: (context) => this.performRemind(context),
            reject: () => Promise.resolve(),
        })
    }

    /**
     * Runs one job of the shift-alerts queue: the minute tick (queue what is due, close the month where it is time), a reminder or a
     * no-show check. A foreign payload is dropped.
     */
    async runJob(payload: object): Promise<void> {
        const job = shiftsJobOf(payload)
        if (job === null) return
        const now = this.clock.now()
        if (job.kind === "tick") {
            await this.scan(now)
            await this.monthClose.tick(now)
            return
        }
        await this.runAlert(job, now)
    }

    /** Queues every reminder and no-show check that is due now; a workspace that fails is logged and the others still run. */
    async scan(now: Date): Promise<AlertScan> {
        const workspaces = await this.entityManager.query<Array<ReminderWorkspaceRow>>(SELECT_REMINDER_WORKSPACES)
        const today = todayVn(now)
        let reminders = 0
        let noShows = 0
        await eachInOrder(workspaces, async (workspace) => {
            try {
                const minutes = alertMinutesOf(workspace.config, workspace.remind_minutes, workspace.noshow_minutes)
                const queued = await this.scanWorkspace(workspace.workspace_id, minutes, today, now)
                reminders += queued.reminders
                noShows += queued.noShows
            } catch (cause) {
                this.logger.error(ShiftsLogEvent.AlertScanFailed, cause, { workspaceId: workspace.workspace_id })
            }
        })
        return { reminders, noShows }
    }

    private async runAlert(job: ShiftAlertPayload, now: Date): Promise<void> {
        if (job.kind === "remind") await this.remind(job.workspaceId, job.shiftId)
        else await this.noShow(job.workspaceId, job.shiftId, now)
    }

    /** Runs one queued reminder: asks the gate to remind the person, unless the automation was turned off or the shift no longer needs it. */
    async remind(workspaceId: string, shiftId: string): Promise<string> {
        if (!(await this.isOn(workspaceId))) return "skipped: automation off"
        const item = await this.alertShift(workspaceId, shiftId)
        if (item === undefined || item.shift.staffId === null) return "skipped: shift not active"
        if (item.reminded) return "skipped: already reminded"
        const setup = await this.data.loadSetup(workspaceId, false)
        const verdict = await this.gate.request({
            workspaceId,
            actor: ACTOR,
            action: "remind_shift",
            subjectType: "shift",
            subjectId: shiftId,
            dedupeKey: `remind_shift:${shiftId}:${item.shift.staffId}`,
            summary: this.words.text("shifts.remindAskSummary", {
                name: nameOf(setup, item.shift.staffId),
                line: this.words.line(setup, item.shift),
            }),
            fields: { shift_id: shiftId, staff_id: item.shift.staffId },
        })
        return verdict.status
    }

    /** Runs one queued no-show check: tells the managers in Office when nobody checked in and the shift still runs. */
    async noShow(workspaceId: string, shiftId: string, now: Date): Promise<string> {
        if (!(await this.isOn(workspaceId))) return "skipped: automation off"
        const item = await this.alertShift(workspaceId, shiftId)
        if (item === undefined || item.shift.staffId === null) return "skipped: shift not active"
        if (shiftWindow(item.shift).endMs <= now.getTime()) return "skipped: shift is over"
        if (item.checkedIn) return "checked in"
        if (item.alerted) return "already alerted"
        const setup = await this.data.loadSetup(workspaceId, false)
        const name = nameOf(setup, item.shift.staffId)
        await this.notify.toManagers(
            workspaceId,
            this.words.text("shifts.noShowOffice", {
                name,
                minutes: minutesLate(item.shift, now.getTime()),
                line: this.words.line(setup, item.shift),
            }),
            "no_show",
            { shiftId },
        )
        await this.office.logEvidence(workspaceId, {
            kind: "shifts.no_show",
            actor: ACTOR,
            summary: this.words.text("shifts.noShowEvidence", {
                name,
                start: item.shift.start,
                end: item.shift.end,
                date: item.shift.date,
            }),
            evidence: shiftId,
        })
        return "alerted"
    }

    /** The performer of `remind_shift`: the person gets the reminder with the others on duty that day, in Office and on their linked channel. */
    async performRemind(context: PerformContext): Promise<PerformResult> {
        const { workspaceId } = context
        const item = await this.alertShift(workspaceId, fieldText(context.fields, "shift_id"))
        if (item === undefined || item.shift.staffId === null)
            return { summary: this.words.text("shifts.remindInactive"), evidence: "pending" }
        const { shift } = item
        const setup = await this.data.loadSetup(workspaceId, false)
        const person = setup.staff.find((member) => member.id === shift.staffId)
        if (person === undefined) return { summary: this.words.text("shifts.remindNoPerson"), evidence: "pending" }
        const [mates, shop] = await Promise.all([
            this.entityManager.query<Array<NameRow>>(SELECT_DAY_MATES, [workspaceId, shift.date, person.id]),
            this.workspaces.nameOf(workspaceId),
        ])
        const body = this.words.text("shifts.remindBody", {
            position:
                setup.positions.find((position) => position.id === shift.positionId)?.name ??
                this.words.text("shifts.remindPosition"),
            start: shift.start,
            end: shift.end,
            shop: shop === "" ? this.words.text("shifts.remindShop") : shop,
            mates:
                mates.length === 0
                    ? ""
                    : this.words.text("shifts.remindMates", { names: mates.map((mate) => mate.name).join(", ") }),
        })
        const outcome = await this.notify.toStaff(workspaceId, {
            staffId: person.id,
            kind: "reminder",
            body,
            shiftId: shift.id,
            workItemId: context.workItemId,
        })
        return {
            summary: this.words.text(remindDoneKey(outcome.telegram, outcome.zalo), {
                name: person.name,
                start: shift.start,
                end: shift.end,
            }),
            evidence: "captured",
        }
    }

    private async scanWorkspace(
        workspaceId: string,
        minutes: AlertMinutes,
        today: string,
        now: Date,
    ): Promise<AlertScan> {
        const rows = await this.entityManager.query<Array<AlertShiftRow>>(SELECT_ALERT_SHIFTS, [
            workspaceId,
            addDays(today, -1),
            addDays(today, 1),
        ])
        const due = dueAlerts(rows.map(toAlertShift), minutes, now.getTime())
        if (due.length === 0) return { reminders: 0, noShows: 0 }
        await this.entityManager.transaction((tx) =>
            eachInOrder(due, async ({ item, kind }) => {
                const payload: ShiftAlertPayload = { kind, workspaceId, shiftId: item.shift.id }
                await this.outbox.write(
                    tx,
                    SHIFTS_QUEUE,
                    payload,
                    alertJobOf(kind, item.shift.id, item.shift.staffId ?? ""),
                )
            }),
        )
        return {
            reminders: due.filter((entry) => entry.kind === "remind").length,
            noShows: due.filter((entry) => entry.kind === "noshow").length,
        }
    }

    private async isOn(workspaceId: string): Promise<boolean> {
        const [row] = await this.entityManager.query<Array<EnabledRow>>(SELECT_REMINDER_ON, [workspaceId])
        return row?.enabled === true
    }

    private async alertShift(workspaceId: string, shiftId: string): Promise<AlertShift | undefined> {
        if (shiftId === "") return undefined
        const [row] = await this.entityManager.query<Array<AlertShiftRow>>(SELECT_ALERT_SHIFT, [workspaceId, shiftId])
        return row === undefined ? undefined : toAlertShift(row)
    }
}
