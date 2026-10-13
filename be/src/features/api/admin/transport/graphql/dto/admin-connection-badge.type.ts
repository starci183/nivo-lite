import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The connections of one provider with how many are unhealthy. */
export class AdminConnectionBadgeType {
    /** The provider. */
    @Field()
    provider!: string

    /** The count. */
    @Field(() => Int)
    count!: number

    /** The error. */
    @Field(() => Int)
    error!: number

    /** The silent. */
    @Field(() => Int)
    silent!: number
}
