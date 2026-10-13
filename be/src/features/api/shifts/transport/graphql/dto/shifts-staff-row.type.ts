import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A shop staff row not yet linked to a shifts profile. */
export class ShiftsStaffRowType {
    /** The staff row id. */
    @Field(() => ID)
    id!: string

    /** The person's name. */
    @Field(() => String)
    name!: string
}
