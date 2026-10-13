import { Field, ObjectType, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** ContentPillar returned by content settings operations. */
export class ContentPillarType {
    /** id. */
    @Field(() => ID)
    id!: string

    /** workspaceId. */
    @Field(() => ID)
    workspaceId!: string

    /** name. */
    @Field()
    name!: string

    /** description. */
    @Field()
    description!: string

    /** weight. */
    @Field(() => Int)
    weight!: number

    /** sort. */
    @Field(() => Int)
    sort!: number

    /** active. */
    @Field()
    active!: boolean
}
