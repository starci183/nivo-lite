import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One continuous piece of work of one person, in minutes of its day. */
export class ShiftSegType {
    /** The day, YYYY-MM-DD. */
    @Field(() => String)
    date!: string

    /** The start minute. */
    @Field(() => Int)
    s!: number

    /** The end minute. */
    @Field(() => Int)
    e!: number

    /** The position worked. */
    @Field(() => ID)
    pos!: string
}
