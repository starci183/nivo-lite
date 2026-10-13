import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** Coverage of active content themes this month. */
export class ContentPillarCoverageType {
    /** The number of active themes used by the month's posts. */
    @Field(() => Int)
    covered!: number

    /** The number of active themes. */
    @Field(() => Int)
    total!: number
}
