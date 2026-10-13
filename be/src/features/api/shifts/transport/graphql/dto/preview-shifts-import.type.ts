import { Field, ObjectType } from "@nestjs/graphql"
import { PreviewShiftsBlockType } from "./preview-shifts-block.type"
import { PreviewShiftsStaffType } from "./preview-shifts-staff.type"

@ObjectType()
/** What the quick import text would add, without writing it. */
export class PreviewShiftsImportType {
    /** The new positions. */
    @Field(() => [String])
    positions!: Array<string>

    /** The people. */
    @Field(() => [PreviewShiftsStaffType])
    staff!: Array<PreviewShiftsStaffType>

    /** The coverage blocks, one per weekday. */
    @Field(() => [PreviewShiftsBlockType])
    blocks!: Array<PreviewShiftsBlockType>

    /** The lines that could not be read, as sentences. */
    @Field(() => [String])
    errors!: Array<string>
}
