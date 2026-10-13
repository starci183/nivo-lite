import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A check-in of one shift. */
export class ShiftsCheckinType {
    /** The shift. */
    @Field(() => ID)
    shiftId!: string

    /** When the person checked in. */
    @Field(() => String)
    checkedInAt!: string
}
