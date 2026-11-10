import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Who pressed an owner's door onto the agents' work, when, and what it came to. */
export class DoorPressType {
    /** The workspace member who pressed. */
    @Field(() => ID)
    memberId!: string

    /** Their name as it read when they pressed. */
    @Field(() => String)
    memberName!: string

    /** What it came to (the door's outcome). */
    @Field(() => String)
    outcome!: string

    /** When. */
    @Field(() => Date)
    at!: Date
}
