import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A proposed or confirmed interview time. */
export class HiringSlotType {
    /** The start, ISO. */
    @Field(() => String)
    start!: string

    /** The end, ISO. */
    @Field(() => String)
    end!: string
}
