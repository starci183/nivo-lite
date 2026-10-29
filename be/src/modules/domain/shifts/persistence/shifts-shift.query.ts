import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { ShiftsScheduleEntity } from "./entities"

/**
 * A read, over the shifts table under the alias `s`, of the shifts of one workspace joined with the schedule each belongs to, selecting a shift's columns and the state and week
 * of its schedule under camelCase names. The caller adds its own filter, order and bound.
 */
export const selectShiftWithScheduleColumns = <Row extends ObjectLiteral>(
    builder: SelectQueryBuilder<Row>,
    workspaceId: string,
): SelectQueryBuilder<Row> =>
    builder
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
