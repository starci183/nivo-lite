import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One connection of the workspace. */
export class AdminConnectionType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The provider. */
    @Field()
    provider!: string

    /** The name. */
    @Field()
    name!: string

    /** The status. */
    @Field()
    status!: string

    /** The environment. */
    @Field()
    environment!: string

    /** The last event at. */
    @Field(() => String, { nullable: true })
    lastEventAt!: string | null

    /** The last error. */
    @Field(() => String, { nullable: true })
    lastError!: string | null

    /** The health. */
    @Field()
    health!: string
}
