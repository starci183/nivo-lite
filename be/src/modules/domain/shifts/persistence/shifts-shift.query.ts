import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { ShiftsScheduleEntity, ShiftsShiftEntity } from "./entities"

/**
 * A read of the shifts of one workspace joined with the schedule each belongs to, selecting a shift's columns and the state and week
 * of its schedule under camelCase names. The caller adds its own filter, order and bound.
 */
export const selectShiftWithSchedule = (
    manager: EntityManager,
    workspaceId: string,
): SelectQueryBuilder<ShiftsShiftEntity> =>
    manager
        .createQueryBuilder(ShiftsShiftEntity, "s")
        .innerJoin(ShiftsScheduleEntity, "c", "c.id = s.schedule_id")
        .select([
            's.id AS "id"',
            's.schedule_id AS "scheduleId"',
            's.shift_date AS "shiftDate"',
            's.start_time AS "startTime"',
            's.end_time AS "endTime"',
            's.position_id AS "positionId"',
            's.staff_id AS "staffId"',
            's.status AS "status"',
            'c.status AS "scheduleStatus"',
            'c.week_start AS "weekStart"',
        ])
        .where("s.workspace_id = :workspaceId", { workspaceId })
