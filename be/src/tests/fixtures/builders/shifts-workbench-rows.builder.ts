import { WorkItemEntity } from "@modules/domain/work-items"
import type { MockEntityManager } from "@starci/jest-preset"
import {
    ShiftsAvailabilityEntity,
    ShiftsStaffEntity,
    ShiftsLeaveRequestEntity,
    ShiftsScheduleEntity,
    ShiftsShiftEntity,
    ShiftsSwapRequestEntity,
} from "@modules/domain/shifts/persistence/entities"
import { entityOf } from "./entity.builder"
import type { FakeQueryBuilder } from "./entity-query-builder-fake.builder"
import { routedQueryBuilder } from "./routed-query.builder"

/** The current draft of the week of 12 October. */
export const scheduleOf = entityOf(ShiftsScheduleEntity, {
    id: "schedule-2",
    weekStart: "2026-10-12",
    version: 2,
    status: "draft",
    source: "solver",
    costVnd: "120000",
    explanation: "Why",
    solverMs: 40,
    summary: { gaps: 0 },
    evidence: { source: "saved" },
    workItemId: "item-1",
    createdAt: new Date("2026-10-13T01:00:00.000Z"),
    publishedAt: null,
})

/** The first, published version of the same week. */
export const olderScheduleOf = (): ShiftsScheduleEntity =>
    scheduleOf({ id: "schedule-1", version: 1, status: "published", workItemId: null })

/** A published schedule with no work item behind it. */
export const publishedScheduleOf = (): ShiftsScheduleEntity => scheduleOf({ status: "published", workItemId: null })

/** A published schedule that kept no cost, summary or evidence. */
export const bareScheduleOf = (): ShiftsScheduleEntity =>
    scheduleOf({ status: "published", costVnd: "0", summary: null, evidence: null })

/** The 08:00 to 10:00 shift of Cashier on Wednesday 14 October, held by the first profile. */
export const shiftRowOf = entityOf(ShiftsShiftEntity, {
    id: "shift-1",
    shiftDate: "2026-10-14",
    startTime: "08:00:00",
    endTime: "10:00:00",
    positionId: "position-1",
    staffId: "profile-1",
    status: "published",
})

/** The same shift with nobody on it. */
export const openShiftRowOf = (): ShiftsShiftEntity => shiftRowOf({ id: "shift-2", staffId: null })

/** The same shift held by the second profile. */
export const colleagueShiftRowOf = (): ShiftsShiftEntity => shiftRowOf({ id: "shift-3", staffId: "profile-2" })

/** The same shift on the next day. */
export const nextDayShiftRowOf = (): ShiftsShiftEntity => shiftRowOf({ id: "shift-4", shiftDate: "2026-10-15" })

/** A shift of a position the setup does not have. */
export const strayShiftRowOf = (): ShiftsShiftEntity => shiftRowOf({ positionId: "absent" })

/** A pending leave with a work item. */
export const leaveOf = entityOf(ShiftsLeaveRequestEntity, {
    id: "leave-1",
    staffId: "profile-1",
    fromDate: "2026-10-20",
    toDate: "2026-10-21",
    reason: "Trip",
    status: "pending",
    workItemId: "item-2",
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
})

/** A leave filed without a work item. */
export const unlinkedLeaveOf = (): ShiftsLeaveRequestEntity => leaveOf({ workItemId: null })

/** A leave whose work item is gone. */
export const orphanLeaveOf = (): ShiftsLeaveRequestEntity => leaveOf({ id: "leave-2", workItemId: "absent" })

/** A pending swap with no work item. */
export const swapOf = entityOf(ShiftsSwapRequestEntity, {
    id: "swap-1",
    kind: "swap",
    shiftId: "shift-1",
    fromStaffId: "profile-1",
    toStaffId: "profile-2",
    reason: "Exam",
    status: "pending",
    checks: [],
    workItemId: null,
    createdAt: new Date("2026-10-13T03:00:00.000Z"),
})

/** A swap with a work item and a finding of the rule checks. */
export const noticeSwapOf = (): ShiftsSwapRequestEntity => swapOf({ workItemId: "item-1", checks: ["Notice short"] })

/** A swap of a shift and a work item that are gone, with checks stored as an object. */
export const orphanSwapOf = (): ShiftsSwapRequestEntity =>
    swapOf({ id: "swap-2", shiftId: "absent", workItemId: "absent", checks: { stored: "as an object" } })

/** A weekly statement approved for the first profile. */
export const availabilityOf = entityOf(ShiftsAvailabilityEntity, {
    id: "avail-1",
    staffId: "profile-1",
    weekday: 2,
    shiftDate: null,
    startTime: "08:00:00",
    endTime: "12:00:00",
    available: false,
    note: "School",
    status: "approved",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
})

/** A finished work item. */
export const itemOf = entityOf(WorkItemEntity, {
    id: "item-1",
    status: "done",
    proposal: {},
    result: null,
    decidedPath: null,
})

/** The work item that waits for the decision to publish. */
export const publishItemOf = (): WorkItemEntity =>
    itemOf({ id: "item-1", status: "waiting_decision", proposal: { summary: "Publish" } })

/** An approved work item of a legacy row that kept no proposal. */
export const approvedItemOf = (): WorkItemEntity =>
    Object.assign(itemOf({ id: "item-2", result: { summary: "Approved" }, decidedPath: "human" }), { proposal: null })

/** What the reads answer: the rows of each entity, whether the member has a profile, the reminder switch and the figures. */
export interface WorkbenchAnswers {
    /** The rows `find` answers per entity; an entity not listed answers no rows. */
    readonly find?: ReadonlyMap<unknown, ReadonlyArray<object>>
    /** Whether the member has a shifts profile. */
    readonly profile?: boolean
    /** The reminder switch; null when the workspace has no pipeline row. */
    readonly reminder?: boolean | null
    /** The open published shifts counted. */
    readonly gaps?: number
    /** The pending leaves counted. */
    readonly pending?: number
    /** The scheduled minutes of the month. */
    readonly minutes?: string
}

const fromOf = (fake: FakeQueryBuilder): unknown => fake.callsOf("from")[0]?.[0]

/** The raw row a figure read answers: the reminder switch of the pipeline, or the scheduled minutes of the month. */
const figureOf = (read: FakeQueryBuilder, answers: WorkbenchAnswers): object | undefined => {
    if (fromOf(read) === "public.automation_pipelines") {
        return answers.reminder === undefined || answers.reminder === null ? undefined : { enabled: answers.reminder }
    }
    return answers.minutes === undefined ? undefined : { minutes: answers.minutes }
}

/** Makes the manager answer every read of the workbench from the given answers. */
export const answerWorkbenchReads = (em: MockEntityManager, answers: WorkbenchAnswers): void => {
    em.find.mockImplementation(((entity: unknown) => Promise.resolve(answers.find?.get(entity) ?? [])) as never)
    em.findOne.mockImplementation((() =>
        Promise.resolve(answers.profile === true ? entityOf(ShiftsStaffEntity, { id: "profile-1" })() : null)) as never)
    em.count.mockImplementation(((entity: unknown) =>
        Promise.resolve(entity === ShiftsShiftEntity ? (answers.gaps ?? 0) : (answers.pending ?? 0))) as never)
    em.createQueryBuilder.mockImplementation(
        (() =>
            routedQueryBuilder({
                getRawOne: (read) => Promise.resolve(figureOf(read, answers)),
            }).builder) as never,
    )
}
