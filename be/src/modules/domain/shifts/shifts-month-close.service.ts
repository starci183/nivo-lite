import { Injectable } from "@nestjs/common"
import { Like } from "typeorm"
import type { EntityManager } from "typeorm"
import { OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { InjectAccountDirectory } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { Logger } from "@modules/platform/logging"
import { ShiftsNotificationEntity } from "./persistence/entities"
import type { AlertShiftRead, MonthCloseWorkspaceRead, OwnerRead } from "./persistence/shifts-alerts.reads"
import { selectAlertShifts } from "./persistence/shifts-alert-shift.query"
import { MONTH_CLOSE_TEMPLATE, selectEnabledPipelines } from "./persistence/shifts-pipeline.query"
import { money } from "./policies/labels.policy"
import { monthCsvOf, monthLabel, monthSummaryOf, payrollMarker } from "./policies/month-summary.policy"
import { monthToClose, toAlertShift } from "./policies/shift-alerts.policy"
import { clockVn, monthRange } from "./policies/time.policy"
import type { MonthSummary } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsLogEvent } from "./shifts.log-events"

/** The most shifts one month close reads. */
const MONTH_SHIFTS_MAX = 5000

/** Who closes the month, as the log shows it. */
const ACTOR = "NIVO"

/** What closing one month ended in. */
export interface MonthClose {
    /** False when the month was already closed. */
    readonly done: boolean
    /** True when the CSV reached the owner's mailbox. */
    readonly emailed: boolean
    /** The wage total. */
    readonly total: number
}

@Injectable()
/**
 * The monthly hours close (automation `shifts_month_close`): from the day and time the owner picked, the month before
 * is summed (scheduled hours x hourly wage per person), written into Office for the managers and as evidence for Accounting, and mailed
 * to the owner as a CSV when mail can be sent. A month is closed once (its Office line carries a marker).
 */
export class ShiftsMonthCloseService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
        @InjectLogger() private readonly logger: Logger,
        private readonly office: OfficeLog,
        private readonly mail: OutboundMail,
        private readonly data: ShiftsDataService,
        private readonly notify: ShiftsNotifyService,
        private readonly words: ShiftsTextService,
    ) {}

    /** Closes the month in every workspace where it is due; answers how many closed now. A failing workspace is logged and retried next tick. */
    async tick(now: Date): Promise<number> {
        const workspaces = await selectEnabledPipelines(this.entityManager, MONTH_CLOSE_TEMPLATE)
            .select(["p.workspace_id AS workspace_id", "p.config AS config"])
            .getRawMany<MonthCloseWorkspaceRead>()
        const clock = clockVn(now)
        let closed = 0
        await eachInOrder(workspaces, async (workspace) => {
            const month = monthToClose(workspace.config, clock)
            if (month === null) return
            try {
                if ((await this.close(workspace.workspace_id, month)).done) closed += 1
            } catch (cause) {
                this.logger.error(ShiftsLogEvent.MonthCloseFailed, cause, {
                    workspaceId: workspace.workspace_id,
                    month,
                })
            }
        })
        return closed
    }

    /** Closes one month of one workspace; a month already closed answers `done: false` and changes nothing. */
    async close(workspaceId: string, month: string): Promise<MonthClose> {
        const marker = payrollMarker(month)
        const already = await this.entityManager.exists(ShiftsNotificationEntity, {
            where: { workspaceId, kind: "payroll", body: Like(`${marker}%`) },
        })
        if (already) return { done: false, emailed: false, total: 0 }
        const summary = await this.summary(workspaceId, month)
        const label = monthLabel(month)
        const body = this.words.text("shifts.payrollOffice", {
            marker,
            month: label,
            people: summary.rows.length,
            hours: Math.round(summary.hours * 10) / 10,
            total: money(summary.total),
            lines: summary.rows
                .map((row) =>
                    this.words.text("shifts.payrollLine", {
                        name: row.name,
                        shifts: row.shifts,
                        hours: row.hours,
                        wage: money(row.wage),
                        cost: money(row.cost),
                    }),
                )
                .join("\n"),
        })
        const emailed = await this.mailOwner(workspaceId, month, body.replace(marker, "").trim(), summary)
        await this.notify.toManagers(
            workspaceId,
            emailed ? `${body}\n${this.words.text("shifts.payrollEmailed")}` : body,
            "payroll",
        )
        await this.office.logEvidence(workspaceId, {
            kind: "shifts.payroll",
            actor: ACTOR,
            summary: this.words.text("shifts.payrollEvidence", {
                month,
                people: summary.rows.length,
                total: money(summary.total),
            }),
            evidence: JSON.stringify(summary.rows),
        })
        return { done: true, emailed, total: summary.total }
    }

    private async summary(workspaceId: string, month: string): Promise<MonthSummary> {
        const { from, to } = monthRange(month)
        const [setup, rows] = await Promise.all([
            this.data.loadSetup(workspaceId, true),
            selectAlertShifts(this.entityManager, workspaceId, false)
                .andWhere("s.shift_date BETWEEN :from AND :to", { from, to })
                .orderBy("s.shift_date", "ASC")
                .addOrderBy("s.start_time", "ASC")
                .limit(MONTH_SHIFTS_MAX)
                .getRawMany<AlertShiftRead>(),
        ])
        return monthSummaryOf(setup, rows.map(toAlertShift))
    }

    /** Mails the summary with its CSV to the owner (an owner-facing notice); true only when the mail left. */
    private async mailOwner(workspaceId: string, month: string, text: string, summary: MonthSummary): Promise<boolean> {
        const owner = await this.entityManager
            .createQueryBuilder()
            .select("m.user_id", "user_id")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.role = 'owner' AND m.status = 'active'", { workspaceId })
            .orderBy("m.created_at", "ASC")
            .limit(1)
            .getRawOne<OwnerRead>()
        if (owner === undefined) return false
        const account = await this.accounts.accountOf(owner.user_id)
        if (account.kind !== "ok" || account.value.email === "") return false
        const subject = this.words.text("shifts.payrollSubject", { month: monthLabel(month) })
        const csv = monthCsvOf(
            summary,
            this.words.text("shifts.payrollCsvHeader"),
            this.words.text("shifts.payrollCsvTotal"),
        )
        const result = await this.mail.send({
            workspaceId,
            to: account.value.email,
            subject,
            title: subject,
            body: text,
            purpose: "shifts_month_close",
            audience: "owner",
            attachments: [
                { filename: `cong-${month}.csv`, content: `\uFEFF${csv}`, contentType: "text/csv; charset=utf-8" },
            ],
        })
        return result.status === "sent"
    }
}
