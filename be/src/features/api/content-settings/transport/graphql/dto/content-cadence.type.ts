import { Field, ObjectType, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** ContentCadence returned by content settings operations. */
export class ContentCadenceType {
    /** id. */
    @Field(() => ID)
    id!: string

    /** workspaceId. */
    @Field(() => ID)
    workspaceId!: string

    /** channel. */
    @Field()
    channel!: string

    /** postsPerWeek. */
    @Field(() => Int)
    postsPerWeek!: number

    /** days. */
    @Field(() => [Int])
    days!: Array<number>

    /** time. */
    @Field()
    time!: string
}
