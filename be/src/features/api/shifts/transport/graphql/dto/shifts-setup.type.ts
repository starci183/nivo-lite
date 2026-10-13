import { Field, ObjectType } from "@nestjs/graphql"
import { ShiftPositionType } from "./shift-position.type"
import { ShiftStaffType } from "./shift-staff.type"
import { ShiftsBlockType } from "./shifts-block.type"
import { ShiftsSettingsType } from "./shifts-settings.type"

@ObjectType()
/** The shop's setup: positions, people, coverage and rules. */
export class ShiftsSetupType {
    /** The active positions. */
    @Field(() => [[ShiftPositionType]])
    positions!: ReadonlyArray<ShiftPositionType>

    /** Everyone ever added, active or not. */
    @Field(() => [[ShiftStaffType]])
    staff!: ReadonlyArray<ShiftStaffType>

    /** The coverage blocks. */
    @Field(() => [[ShiftsBlockType]])
    blocks!: ReadonlyArray<ShiftsBlockType>

    /** The rules. */
    @Field(() => ShiftsSettingsType)
    settings!: ShiftsSettingsType
}
