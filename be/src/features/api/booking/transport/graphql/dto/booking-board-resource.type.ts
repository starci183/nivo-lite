import { Field, ObjectType, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking board resource view. */
export class BookingBoardResourceType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The kind. */
    @Field(() => String)
    kind!: string

    /** The capacity. */
    @Field(() => Int)
    capacity!: number

    /** The active. */
    @Field(() => Boolean)
    active!: boolean

    /** The sort. */
    @Field(() => Int)
    sort!: number

    /** The color. */
    @Field(() => String)
    color!: string

    /** The staff id. */
    @Field(() => ID, { nullable: true })
    staffId!: string | null
}
