import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What giving a draft shift to another person ended in. */
export class ReassignShiftsShiftType {
    /** The rules the new assignment breaks. Empty when the shift is opened or nothing breaks. */
    @Field(() => [String])
    warnings!: Array<string>
}
