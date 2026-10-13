import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The booking board exception view. */
export class BookingBoardExceptionType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The resource id. */
    @Field(() => ID, { nullable: true })
    resourceId!: string | null

    /** The date. */
    @Field(() => String)
    date!: string

    /** The closed. */
    @Field(() => Boolean)
    closed!: boolean

    /** The start. */
    @Field(() => String, { nullable: true })
    start!: string | null

    /** The end. */
    @Field(() => String, { nullable: true })
    end!: string | null

    /** The note. */
    @Field(() => String)
    note!: string
}
