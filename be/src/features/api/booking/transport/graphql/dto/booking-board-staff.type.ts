import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The booking board staff view. */
export class BookingBoardStaffType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string
}
