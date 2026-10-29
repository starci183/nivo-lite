import { Test } from "@nestjs/testing"
import { builder, FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AutomationPipelinesService } from "@modules/domain/automation-pipelines"
import { ActionPerformerRegistry, ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { isRecord } from "@modules/platform/primitives"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { PIPELINE } from "@tests/fixtures/builders/shifts-workbench-bench.builder"
import { SHIFT_STAFF } from "@tests/fixtures/builders/shifts-workbench.builder"
import { routedQueryBuilder } from "@tests/fixtures/builders/routed-query.builder"
import type { FakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ShiftsSettingsEntity } from "./persistence/entities"
import type { AlertShiftRead, ReminderWorkspaceRead } from "./persistence/shifts-alerts.contracts"
import { DEFAULT_SETTINGS } from "./policies/row-mappers.policy"
import { ShiftsAlertsService } from "./shifts-alerts.service"
import type { Setup, ShiftStaff } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"
import { ShiftsLogEvent } from "./shifts.log-events"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)
const stringLike = (text: string): unknown => expect.stringContaining(text)
const anything = (): unknown => expect.anything()

/** 07:00 in Vietnam on 2026-10-14: one hour before the 08:00 shift. */
const NOW = "2026-10-14T00:00:00.000Z"

const row = builder<AlertShiftRead>({
    id: "s-1",
    schedule_id: "sch-1",
    shift_date: "2026-10-14",
    start_time: "08:00:00",
    end_time: "12:00:00",
    position_id: "pos-1",
    staff_id: "p-1",
    status: "published",
    checked_in: false,
    reminded: false,
    alerted: false,
})

const staffOf = builder<ShiftStaff>(SHIFT_STAFF)

const SETUP: Setup = {
    positions: [{ id: "pos-1", name: "Barista", color: "#000" }],
    staff: [staffOf({ id: "p-1", name: "Lan", positionIds: ["pos-1"], wage: 0, maxWeek: 48, maxDay: 10, minRest: 8 })],
    blocks: [],
    settings: DEFAULT_SETTINGS,
}

const WORKSPACE: ReminderWorkspaceRead = {
    workspace_id: "ws-1",
    config: null,
    remind_minutes: 60,
    noshow_minutes: 10,
}

/** What the reads of the service answer. */
interface Answers {
    readonly workspaces?: ReadonlyArray<ReminderWorkspaceRead>
    readonly mates?: ReadonlyArray<{ readonly name: string }>
    readonly failFor?: string
}

/** Hands out one fake builder per read, answering the shifts, and answers back every builder it made. */
const answer = (
    em: MockEntityManager,
    rows: ReadonlyArray<AlertShiftRead>,
    options: Answers = {},
): Array<FakeQueryBuilder> => {
    const built: Array<FakeQueryBuilder> = []
    const workspaces = options.workspaces ?? [WORKSPACE]
    const rules = workspaces.filter((entry) => entry.remind_minutes !== null && entry.noshow_minutes !== null)
    em.find.mockResolvedValue(
        rules.map((entry) =>
            Object.assign(new ShiftsSettingsEntity(), {
                workspaceId: entry.workspace_id,
                remindMinutes: entry.remind_minutes,
                noshowMinutes: entry.noshow_minutes,
            }),
        ),
    )
    em.createQueryBuilder.mockImplementation(() => {
        const fake: FakeQueryBuilder = routedQueryBuilder({
            getRawMany: (read) => {
                if (read.callsOf("distinct").length > 0) return Promise.resolve(options.mates ?? [{ name: "Minh" }])
                const where = read.callsOf("where")[0]?.[1]
                if (isRecord(where) && where.workspaceId !== undefined && where.workspaceId === options.failFor) {
                    return Promise.reject(new TypeError("workspace query failed"))
                }
                return Promise.resolve(rows)
            },
            getRawOne: () => Promise.resolve(rows[0]),
        })
        built.push(fake)
        return fake.builder
    })
    return built
}

const build = async (
    em: MockEntityManager,
    now = NOW,
    stored: { enabled: boolean | null; workspaces: ReadonlyArray<ReminderWorkspaceRead> } = {
        enabled: true,
        workspaces: [WORKSPACE],
    },
) => {
    const pipelines = mock<AutomationPipelinesService>()
    pipelines.enabledOfTemplate.mockResolvedValue(
        stored.workspaces.map((workspace) => ({ ...PIPELINE, workspace_id: workspace.workspace_id })),
    )
    pipelines.findPipeline.mockResolvedValue(stored.enabled === null ? null : { ...PIPELINE, enabled: stored.enabled })
    const outbox = recordingQueueOutbox()
    const registry = mock<ActionPerformerRegistry>()
    const gate = mock<ApprovalGate>()
    gate.request.mockResolvedValue({ status: "done", workItemId: "wi-1" })
    const office = mock<OfficeLog>()
    office.logEvidence.mockResolvedValue(undefined)
    const workspaces = mock<WorkspacesService>()
    workspaces.nameOf.mockResolvedValue("Spa")
    const data = mock<ShiftsDataService>({ loadSetup: () => Promise.resolve(SETUP) })
    const monthClose = mock<ShiftsMonthCloseService>()
    monthClose.tick.mockResolvedValue(0)
    const logger = mock<Logger>()
    const notify = mock<ShiftsNotifyService>()
    notify.toStaff.mockResolvedValue({ office: true, telegram: true, zalo: null })
    notify.toManagers.mockResolvedValue(undefined)
    const words = mock<ShiftsTextService>({
        text: (key: string, params?: Record<string, string | number>) =>
            `${key}${params ? JSON.stringify(params) : ""}`,
        line: () => "line",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsAlertsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: LOGGER, useValue: logger },
            { provide: CLOCK, useValue: new FakeClock(now) },
            { provide: ActionPerformerRegistry, useValue: registry },
            { provide: ApprovalGate, useValue: gate },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: AutomationPipelinesService, useValue: pipelines },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsMonthCloseService, useValue: monthClose },
            { provide: ShiftsNotifyService, useValue: notify },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return {
        service: moduleRef.get(ShiftsAlertsService),
        outbox,
        registry,
        gate,
        office,
        monthClose,
        notify,
        logger,
        workspaces,
        pipelines,
    }
}

/** A manager answering the given shift rows, with the service built over it; `transactional` lets the service open transactions. */
const prepare = async (
    rows: ReadonlyArray<AlertShiftRead>,
    enabled: boolean | null = true,
    options: Answers = {},
    now = NOW,
    transactional = false,
) => {
    const em = transactional ? fakeTransaction(mockEntityManager()).em : mockEntityManager()
    const built = answer(em, rows, options)
    const stored = { enabled, workspaces: options.workspaces ?? [WORKSPACE] }
    return { em, built, ...(await build(em, now, stored)) }
}

const context = (fields: PerformContext["fields"]): PerformContext => ({
    workspaceId: "ws-1",
    workItemId: "wi-1",
    actor: "NIVO",
    draft: null,
    fields,
})

const FALLBACK_BODY = `shifts.remindBody${JSON.stringify({
    position: "shifts.remindPosition",
    start: "08:00",
    end: "12:00",
    shop: "shifts.remindShop",
    mates: "",
})}`

describe("ShiftsAlertsService", () => {
    it("runs the registered performer and accepts rejection without sending a reminder", async () => {
        const { service, registry, notify } = await prepare([])
        service.onModuleInit()
        const performer = registry.add.mock.calls[0]?.[0]

        expect(performer?.action).toBe("remind_shift")
        await expect(performer?.perform(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: "shifts.remindInactive",
            evidence: "pending",
        })
        await expect(performer?.reject?.(context({}))).resolves.toBeUndefined()
        expect(notify.toStaff).not.toHaveBeenCalled()
    })

    it("returns zero counts without opening a transaction when no alerts are due", async () => {
        const { service, outbox, built, em } = await prepare([row({ reminded: true, checked_in: true })])

        await expect(service.scan(new Date(NOW))).resolves.toEqual({ reminders: 0, noShows: 0 })
        expect(built.flatMap((fake) => fake.callsOf("andWhere"))).toContainEqual([
            "s.shift_date BETWEEN :first AND :last",
            { first: "2026-10-13", last: "2026-10-15" },
        ])
        expect(em.transaction).not.toHaveBeenCalled()
        expect(outbox.jobs).toEqual([])
    })

    it("falls back to the default minutes for a workspace that has no shifts rules yet", async () => {
        const { service } = await prepare(
            [row()],
            true,
            { workspaces: [{ workspace_id: "ws-1", config: null, remind_minutes: null, noshow_minutes: null }] },
            NOW,
            true,
        )

        await expect(service.scan(new Date(NOW))).resolves.toEqual({ reminders: 1, noShows: 0 })
    })

    it("logs a failed workspace and queues both alert kinds for the next workspace", async () => {
        const failure = new TypeError("workspace query failed")
        const { service, outbox, logger } = await prepare(
            [row({ id: "reminder", staff_id: null, start_time: "09:00:00" }), row({ id: "noshow", reminded: true })],
            true,
            { workspaces: [{ ...WORKSPACE, workspace_id: "failed" }, WORKSPACE], failFor: "failed" },
            NOW,
            true,
        )
        const write = jest.spyOn(outbox, "write")

        await expect(service.scan(new Date("2026-10-14T01:15:00.000Z"))).resolves.toEqual({
            reminders: 1,
            noShows: 1,
        })
        expect(logger.error).toHaveBeenCalledWith(ShiftsLogEvent.AlertScanFailed, failure, {
            workspaceId: "failed",
        })
        expect(outbox.allInTransaction).toBe(true)
        expect(write).toHaveBeenCalledWith(
            anything(),
            "shifts_alerts",
            { kind: "remind", workspaceId: "ws-1", shiftId: "reminder" },
            { job: "shifts.remind", dedupeKey: "shifts.remind:reminder:" },
        )
        expect(write).toHaveBeenCalledWith(
            anything(),
            "shifts_alerts",
            { kind: "noshow", workspaceId: "ws-1", shiftId: "noshow" },
            { job: "shifts.noshow", dedupeKey: "shifts.noshow:noshow:p-1" },
        )
    })
})

describe("ShiftsAlertsService runJob", () => {
    it("on a tick queues the due reminder once per shift and person, then closes the month where due", async () => {
        const { service, outbox, monthClose } = await prepare([row()], true, {}, NOW, true)

        await service.runJob({ kind: "tick" })

        expect(outbox.jobsOf("shifts_alerts")).toEqual([
            { queue: "shifts_alerts", payload: { kind: "remind", workspaceId: "ws-1", shiftId: "s-1" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
        expect(monthClose.tick).toHaveBeenCalledWith(new Date(NOW))
    })

    it("queues a no-show check after the delay", async () => {
        const { service, outbox } = await prepare([row({ reminded: true })], true, {}, "2026-10-14T01:15:00.000Z", true)

        await service.runJob({ kind: "tick" })

        expect(outbox.jobsOf("shifts_alerts")).toEqual([
            { queue: "shifts_alerts", payload: { kind: "noshow", workspaceId: "ws-1", shiftId: "s-1" } },
        ])
    })

    it("drops a foreign payload", async () => {
        const em = mockEntityManager()
        const { service, gate } = await build(em)

        await service.runJob({ commandId: "c-1" })

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
        expect(gate.request).not.toHaveBeenCalled()
    })

    it("asks the gate to remind the person of a queued shift", async () => {
        const { service, gate } = await prepare([row()])

        await service.runJob({ kind: "remind", workspaceId: "ws-1", shiftId: "s-1" })

        expect(gate.request).toHaveBeenCalledWith(
            objectLike({
                action: "remind_shift",
                dedupeKey: "remind_shift:s-1:p-1",
                fields: { shift_id: "s-1", staff_id: "p-1" },
            }),
        )
    })

    it("tells the managers when nobody checked in", async () => {
        const { service, notify, office } = await prepare(
            [row({ reminded: true })],
            true,
            {},
            "2026-10-14T01:15:00.000Z",
        )

        await service.runJob({ kind: "noshow", workspaceId: "ws-1", shiftId: "s-1" })

        expect(notify.toManagers).toHaveBeenCalledWith("ws-1", stringLike("shifts.noShowOffice"), "no_show", {
            shiftId: "s-1",
        })
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", objectLike({ kind: "shifts.no_show" }))
    })
})

describe("ShiftsAlertsService remind", () => {
    it("returns the gate verdict with the exact reminder request", async () => {
        const { service, gate } = await prepare([row()])
        gate.request.mockResolvedValue({ status: "pending", workItemId: "wi-pending" })

        await expect(service.remind("ws-1", "s-1")).resolves.toBe("pending")
        expect(gate.request).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            actor: "NIVO",
            action: "remind_shift",
            subjectType: "shift",
            subjectId: "s-1",
            dedupeKey: "remind_shift:s-1:p-1",
            summary: 'shifts.remindAskSummary{"name":"Lan","line":"line"}',
            fields: { shift_id: "s-1", staff_id: "p-1" },
        })
    })

    it("skips when the automation is off, the shift is gone or unassigned, or the person was reminded", async () => {
        const off = await prepare([row()], false)
        await expect(off.service.remind("ws-1", "s-1")).resolves.toBe("skipped: automation off")

        const gone = await prepare([])
        await expect(gone.service.remind("ws-1", "s-1")).resolves.toBe("skipped: shift not active")
        const unassigned = await prepare([row({ staff_id: null })])
        await expect(unassigned.service.remind("ws-1", "s-1")).resolves.toBe("skipped: shift not active")
        expect(unassigned.gate.request).not.toHaveBeenCalled()

        const done = await prepare([row({ reminded: true })])
        await expect(done.service.remind("ws-1", "s-1")).resolves.toBe("skipped: already reminded")
    })
})

describe("ShiftsAlertsService noShow", () => {
    it.each([{ rows: [] }, { rows: [row({ staff_id: null })] }])("skips inactive shift rows %p", async ({ rows }) => {
        const { service, notify, office } = await prepare(rows)

        await expect(service.noShow("ws-1", "s-1", new Date(NOW))).resolves.toBe("skipped: shift not active")
        expect(notify.toManagers).not.toHaveBeenCalled()
        expect(office.logEvidence).not.toHaveBeenCalled()
    })

    it("skips when the enabled query has no row", async () => {
        const { service, notify, pipelines } = await prepare([], null)

        await expect(service.noShow("ws-1", "s-1", new Date(NOW))).resolves.toBe("skipped: automation off")
        expect(pipelines.findPipeline).toHaveBeenCalledWith("ws-1", "shifts_shift_reminder")
        expect(notify.toManagers).not.toHaveBeenCalled()
    })

    it("records the exact no-show notice and evidence", async () => {
        const { service, notify, office } = await prepare([row()])

        await expect(service.noShow("ws-1", "s-1", new Date("2026-10-14T01:15:00.000Z"))).resolves.toBe("alerted")
        expect(notify.toManagers).toHaveBeenCalledWith(
            "ws-1",
            'shifts.noShowOffice{"name":"Lan","minutes":15,"line":"line"}',
            "no_show",
            { shiftId: "s-1" },
        )
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", {
            kind: "shifts.no_show",
            actor: "NIVO",
            summary: 'shifts.noShowEvidence{"name":"Lan","start":"08:00","end":"12:00","date":"2026-10-14"}',
            evidence: "s-1",
        })
    })

    it.each([
        ["a checked-in person", row({ checked_in: true }), "2026-10-14T01:15:00.000Z", "checked in"],
        ["an alert already sent", row({ alerted: true }), "2026-10-14T01:15:00.000Z", "already alerted"],
        ["a shift that is over", row(), "2026-10-14T05:00:00.000Z", "skipped: shift is over"],
    ])("sends nothing for %s", async (_name, shift, now, verdict) => {
        const { service, notify } = await prepare([shift], true, {}, now)

        await expect(service.noShow("ws-1", "s-1", new Date(now))).resolves.toBe(verdict)
        expect(notify.toManagers).not.toHaveBeenCalled()
    })
})

describe("ShiftsAlertsService performRemind", () => {
    it.each([
        { telegram: false, zalo: true, key: "shifts.remindDoneZalo" },
        { telegram: null, zalo: null, key: "shifts.remindDoneOffice" },
    ])("uses fallback labels and reports delivery %p", async ({ telegram, zalo, key }) => {
        const { service, notify, workspaces, built } = await prepare([row({ position_id: "missing" })], true, {
            mates: [],
        })
        workspaces.nameOf.mockResolvedValue("")
        notify.toStaff.mockResolvedValue({ office: true, telegram, zalo })

        await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: `${key}{"name":"Lan","start":"08:00","end":"12:00"}`,
            evidence: "captured",
        })
        expect(notify.toStaff).toHaveBeenCalledWith("ws-1", {
            staffId: "p-1",
            kind: "reminder",
            shiftId: "s-1",
            workItemId: "wi-1",
            body: FALLBACK_BODY,
        })
        const where = built.flatMap((fake) => fake.callsOf("where"))
        expect(where).toContainEqual([
            stringLike("s.staff_id <> :personId"),
            { workspaceId: "ws-1", day: "2026-10-14", personId: "p-1" },
        ])
        expect(workspaces.nameOf).toHaveBeenCalledWith("ws-1")
    })

    it("returns a pending result for a person removed from setup", async () => {
        const { service, notify } = await prepare([row({ staff_id: "removed" })])

        await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: "shifts.remindNoPerson",
            evidence: "pending",
        })
        expect(notify.toStaff).not.toHaveBeenCalled()
    })

    it.each<PerformContext["fields"]>([{}, { shift_id: "s-1" }])(
        "does not send an unassigned reminder for fields %p",
        async (fields) => {
            const { service, notify } = await prepare([row({ staff_id: null })])

            await expect(service.performRemind(context(fields))).resolves.toEqual({
                summary: "shifts.remindInactive",
                evidence: "pending",
            })
            expect(notify.toStaff).not.toHaveBeenCalled()
        },
    )

    it("reminds the person with the others on duty and says where it went", async () => {
        const { service, notify } = await prepare([row()])

        const result = await service.performRemind(context({ shift_id: "s-1", staff_id: "p-1" }))

        expect(notify.toStaff).toHaveBeenCalledWith(
            "ws-1",
            objectLike({ staffId: "p-1", kind: "reminder", shiftId: "s-1", workItemId: "wi-1" }),
        )
        expect(result).toEqual({
            summary: stringLike("shifts.remindDoneTelegram"),
            evidence: "captured",
        })
    })

    it("reminds nobody for a shift that is no longer active", async () => {
        const { service, notify } = await prepare([])

        await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
            summary: "shifts.remindInactive",
            evidence: "pending",
        })
        expect(notify.toStaff).not.toHaveBeenCalled()
    })
})
