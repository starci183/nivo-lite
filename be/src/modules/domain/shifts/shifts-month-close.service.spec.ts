import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import type { PipelineConfig, PipelineRow } from "@modules/domain/automation-pipelines"
import { OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { ACCOUNT_DIRECTORY, WorkspaceMemberDirectoryService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { routedQueryBuilder } from "@tests/fixtures/builders/routed-query.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { Like } from "typeorm"
import { ShiftsNotificationEntity } from "./persistence/entities"
import type { AlertShiftRead } from "./persistence/shifts-alerts.reads"
import { DEFAULT_SETTINGS } from "./policies/row-mappers.policy"
import type { Setup } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsLogEvent } from "./shifts.log-events"

const SETUP: Setup = {
    positions: [],
    staff: [
        {
            id: "p-1",
            name: "Lan",
            positionIds: [],
            skills: [],
            wage: 30000,
            maxWeek: 48,
            maxDay: 10,
            minRest: 8,
            staffRowId: null,
            telegramChatId: null,
            zaloUserId: null,
            phone: null,
            active: true,
        },
    ],
    blocks: [],
    settings: DEFAULT_SETTINGS,
}

const WORKSPACES = [{ workspace_id: "ws-1", config: { day: 1, time: "09:00" } }]

const SHIFT: AlertShiftRead = {
    id: "s-1",
    schedule_id: "sch",
    shift_date: "2026-09-03",
    start_time: "08:00",
    end_time: "12:00",
    position_id: "pos",
    staff_id: "p-1",
    status: "published",
    checked_in: true,
    reminded: false,
    alerted: false,
}

/** The pipeline the owner of automations lists for a workspace whose month close is on. */
const pipelineOf = (workspace: { workspace_id: string; config: PipelineConfig }): PipelineRow => ({
    id: "pipeline-1",
    workspace_id: workspace.workspace_id,
    template_key: "shifts_month_close",
    name: "Month close",
    module_key: "shifts",
    enabled: true,
    dismissed: false,
    config: workspace.config,
    body: null,
    body_version: 0,
    template_version: 1,
    based_on_context: null,
    approval_streak: 0,
    trust_offered_at: null,
    auto_send: false,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
})

/** What `answer` set up for a manager: whether the workspace has an owner and which workspaces have the close on. */
interface Setting {
    readonly owner: boolean
    readonly workspaces: ReadonlyArray<{ workspace_id: string; config: PipelineConfig }>
}

const settingOfManager = new WeakMap<object, Setting>()

/** Whether the month was closed already (null: no marker line yet) and whether the workspace has an owner; the builders made are answered back. */
const answer = (
    done: boolean | null,
    owner: boolean,
    workspaces: ReadonlyArray<{ workspace_id: string; config: PipelineConfig }> = WORKSPACES,
): { readonly em: MockEntityManager; readonly built: Array<FakeQueryBuilder> } => {
    const em = mockEntityManager({ exists: [ShiftsNotificationEntity, done === true] })
    settingOfManager.set(em, { owner, workspaces })
    const built: Array<FakeQueryBuilder> = []
    em.createQueryBuilder.mockImplementation(() => {
        const fake: FakeQueryBuilder = routedQueryBuilder({ getRawMany: () => Promise.resolve([SHIFT]) })
        built.push(fake)
        return fake.builder as never
    })
    return { em, built }
}

const build = async (em: MockEntityManager) => {
    const setting = settingOfManager.get(em) ?? { owner: true, workspaces: WORKSPACES }
    const pipelines = mock<AutomationPipelinesService>()
    pipelines.enabledOfTemplate.mockResolvedValue(setting.workspaces.map(pipelineOf))
    const members = mock<WorkspaceMemberDirectoryService>()
    members.firstActiveOwnerUserId.mockResolvedValue(setting.owner ? "u-1" : null)
    const accounts = mock<AccountDirectory>()
    accounts.accountOf.mockResolvedValue({
        kind: "ok",
        value: { email: "owner@shop.test", lastSignInAt: null, displayName: "O" },
    })
    const office = mock<OfficeLog>()
    office.logEvidence.mockResolvedValue(undefined)
    const mail = mock<OutboundMail>()
    mail.send.mockResolvedValue({ status: "sent" })
    const data = mock<ShiftsDataService>()
    data.loadSetup.mockResolvedValue(SETUP)
    const notify = mock<ShiftsNotifyService>()
    notify.toManagers.mockResolvedValue(undefined)
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation((key: string) => key)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsMonthCloseService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
            { provide: LOGGER, useValue: logger },
            { provide: OfficeLog, useValue: office },
            { provide: OutboundMail, useValue: mail },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsNotifyService, useValue: notify },
            { provide: ShiftsTextService, useValue: words },
            { provide: AutomationPipelinesService, useValue: pipelines },
            { provide: WorkspaceMemberDirectoryService, useValue: members },
        ],
    }).compile()
    return {
        service: moduleRef.get(ShiftsMonthCloseService),
        office,
        mail,
        notify,
        accounts,
        logger,
        data,
        words,
        pipelines,
        members,
    }
}

describe("ShiftsMonthCloseService", () => {
    it("closes the month: the CSV to the owner, the summary to Office and the evidence for Accounting", async () => {
        const { em } = answer(false, true)
        const { service, mail, notify, office } = await build(em)

        await expect(service.close("ws-1", "2026-09")).resolves.toEqual({ done: true, emailed: true, total: 120000 })

        expect(mail.send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "owner@shop.test",
                purpose: "shifts_month_close",
                audience: "owner",
                attachments: [expect.objectContaining({ filename: "cong-2026-09.csv" })],
            }),
        )
        expect(notify.toManagers).toHaveBeenCalledWith(
            "ws-1",
            expect.stringContaining("shifts.payrollEmailed"),
            "payroll",
        )
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", expect.objectContaining({ kind: "shifts.payroll" }))
    })

    it("closes a month once", async () => {
        const { em } = answer(true, true)
        const { service, notify } = await build(em)

        await expect(service.close("ws-1", "2026-09")).resolves.toEqual({ done: false, emailed: false, total: 0 })
        expect(notify.toManagers).not.toHaveBeenCalled()
    })

    it("still posts the summary when there is no owner to mail", async () => {
        const { em } = answer(false, false)
        const { service, mail, notify } = await build(em)

        await expect(service.close("ws-1", "2026-09")).resolves.toMatchObject({ done: true, emailed: false })
        expect(mail.send).not.toHaveBeenCalled()
        expect(notify.toManagers).toHaveBeenCalledWith("ws-1", "shifts.payrollOffice", "payroll")
    })

    it("on a tick closes the previous month of every workspace past its day and time", async () => {
        const { em } = answer(false, false)
        const { service, pipelines } = await build(em)

        await expect(service.tick(new Date("2026-10-01T03:00:00.000Z"))).resolves.toBe(1)
        await expect(service.tick(new Date("2026-10-01T01:00:00.000Z"))).resolves.toBe(0)
        expect(pipelines.enabledOfTemplate).toHaveBeenCalledWith("shifts_month_close", 2000)
    })

    it.each([
        { kind: "refused" as const, code: "missing" },
        { kind: "ok" as const, value: { email: "", lastSignInAt: null, displayName: "Owner" } },
    ])("closes without mail when the owner account cannot receive it: %j", async (account) => {
        const { em } = answer(false, true)
        const { service, accounts, mail, notify } = await build(em)
        accounts.accountOf.mockResolvedValue(account)

        await expect(service.close("ws-1", "2026-09")).resolves.toEqual({ done: true, emailed: false, total: 120000 })

        expect(accounts.accountOf).toHaveBeenCalledWith("u-1")
        expect(mail.send).not.toHaveBeenCalled()
        expect(notify.toManagers).toHaveBeenCalledWith("ws-1", "shifts.payrollOffice", "payroll")
    })
})

describe("ShiftsMonthCloseService", () => {
    it("builds the payroll text, CSV and evidence even when mail fails and no prior marker exists", async () => {
        const { em, built } = answer(null, true)
        const { service, words, mail, office, notify, data, members } = await build(em)
        words.text.mockImplementation((key, params) => {
            if (key === "shifts.payrollOffice") return `${params?.marker}  Monthly wages  `
            return key
        })
        mail.send.mockResolvedValue({ status: "failed", error: "transport_down" })

        await expect(service.close("ws-1", "2026-09")).resolves.toEqual({ done: true, emailed: false, total: 120000 })

        expect(em.exists).toHaveBeenCalledWith(ShiftsNotificationEntity, {
            where: { workspaceId: "ws-1", kind: "payroll", body: Like("[payroll:2026-09]%") },
        })
        expect(built.flatMap((fake) => fake.callsOf("andWhere"))).toContainEqual([
            "s.shift_date BETWEEN :from AND :to",
            { from: "2026-09-01", to: "2026-09-30" },
        ])
        expect(members.firstActiveOwnerUserId).toHaveBeenCalledWith("ws-1")
        expect(data.loadSetup).toHaveBeenCalledWith("ws-1", true)
        expect(words.text).toHaveBeenCalledWith("shifts.payrollLine", {
            name: "Lan",
            shifts: 1,
            hours: 4,
            wage: "30.000\u0111",
            cost: "120.000\u0111",
        })
        expect(words.text).toHaveBeenCalledWith("shifts.payrollOffice", {
            marker: "[payroll:2026-09]",
            month: "09/2026",
            people: 1,
            hours: 4,
            total: "120.000\u0111",
            lines: "shifts.payrollLine",
        })
        expect(mail.send).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            to: "owner@shop.test",
            subject: "shifts.payrollSubject",
            title: "shifts.payrollSubject",
            body: "Monthly wages",
            purpose: "shifts_month_close",
            audience: "owner",
            attachments: [
                {
                    filename: "cong-2026-09.csv",
                    content:
                        '\uFEFFshifts.payrollCsvHeader\n"Lan","1","4","4","30000",' +
                        '"120000"\n"shifts.payrollCsvTotal","","4","","","120000"',
                    contentType: "text/csv; charset=utf-8",
                },
            ],
        })
        expect(notify.toManagers).toHaveBeenCalledWith("ws-1", "[payroll:2026-09]  Monthly wages  ", "payroll")
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "shifts.payroll",
            actor: "NIVO",
            summary: "shifts.payrollEvidence",
            evidence: JSON.stringify([{ name: "Lan", shifts: 1, hours: 4, checked: 4, wage: 30000, cost: 120000 }]),
        })
    })
})

describe("ShiftsMonthCloseService", () => {
    it("counts only new closes and continues after a workspace fails", async () => {
        const { em } = answer(null, false, [
            { workspace_id: "ws-closed", config: { day: 1, time: "09:00" } },
            { workspace_id: "ws-failed", config: { day: 1, time: "09:00" } },
            { workspace_id: "ws-new", config: { day: 1, time: "09:00" } },
        ])
        const { service, logger } = await build(em)
        const cause = new Error("cannot read payroll")
        const close = jest
            .spyOn(service, "close")
            .mockResolvedValueOnce({ done: false, emailed: false, total: 0 })
            .mockRejectedValueOnce(cause)
            .mockResolvedValueOnce({ done: true, emailed: true, total: 120000 })

        await expect(service.tick(new Date("2026-10-01T03:00:00.000Z"))).resolves.toBe(1)

        expect(close.mock.calls).toEqual([
            ["ws-closed", "2026-09"],
            ["ws-failed", "2026-09"],
            ["ws-new", "2026-09"],
        ])
        expect(logger.error).toHaveBeenCalledWith(ShiftsLogEvent.MonthCloseFailed, cause, {
            workspaceId: "ws-failed",
            month: "2026-09",
        })
    })
})
