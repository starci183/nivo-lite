import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"
import { ShiftsAttendanceEntity, ShiftsNotificationEntity } from "./entities"

/**
 * A read, over the shifts table under the alias `s`, of the live assigned shifts of one workspace (published or swapped, with a person) selecting a shift's columns under their
 * column names and whether the person checked in, was reminded and was reported as a no-show. `flags: false` answers reminded and alerted
 * as false without looking. The caller adds its own filter, order and bound.
 */
export const selectAlertShiftColumns = <Row extends ObjectLiteral>(
    builder: SelectQueryBuilder<Row>,
    workspaceId: string,
    flags: boolean,
): SelectQueryBuilder<Row> => {
    const shifts = builder
        .select([
            "s.id AS id",
            "s.schedule_id AS schedule_id",
            "s.shift_date AS shift_date",
            "s.start_time AS start_time",
            "s.end_time AS end_time",
            "s.position_id AS position_id",
            "s.staff_id AS staff_id",
            "s.status AS status",
        ])
        .addSelect(
            (sub) => sub.select("count(*) > 0").from(ShiftsAttendanceEntity, "a").where("a.shift_id = s.id"),
            "checked_in",
        )
    const withFlags = flags
        ? shifts
              .addSelect(
                  (sub) =>
                      sub
                          .select("count(*) > 0")
                          .from(ShiftsNotificationEntity, "n")
                          .where("n.shift_id = s.id AND n.staff_id = s.staff_id AND n.kind = 'reminder'"),
                  "reminded",
              )
              .addSelect(
                  (sub) =>
                      sub
                          .select("count(*) > 0")
                          .from(ShiftsNotificationEntity, "n")
                          .where("n.shift_id = s.id AND n.kind = 'no_show'"),
                  "alerted",
              )
        : shifts.addSelect("false", "reminded").addSelect("false", "alerted")
    return withFlags.where(
        "s.workspace_id = :workspaceId AND s.status IN ('published', 'swapped') AND s.staff_id IS NOT NULL",
        { workspaceId },
    )
}
