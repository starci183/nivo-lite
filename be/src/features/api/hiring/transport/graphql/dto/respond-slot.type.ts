import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What picking an interview time answers. */
export class RespondSlotType {
    /** What came of it. */
    @Field(() => String)
    outcome!: string

    /** The confirmed time. */
    @Field(() => String, { nullable: true })
    slotStart!: string | null
}
