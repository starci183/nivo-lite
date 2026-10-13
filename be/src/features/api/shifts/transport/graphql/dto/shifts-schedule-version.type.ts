import { Field, ID, Int, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One version of a week, header only. */
export class ShiftsScheduleVersionType {
    /** The schedule id. */
    @Field(() => ID)
    id!: string

    /** The version number. */
    @Field(() => Int)
    version!: number

    /** draft, published or superseded. */
    @Field(() => String)
    status!: string

    /** The estimated wage cost. */
    @Field(() => Float)
    costVnd!: number

    /** When it was made. */
    @Field(() => String)
    createdAt!: string

    /** When it was published. */
    @Field(() => String, { nullable: true })
    publishedAt!: string | null
}
