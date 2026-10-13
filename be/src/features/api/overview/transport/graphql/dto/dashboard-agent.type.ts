import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One AI employee of the workspace. */
export class DashboardAgentType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** The module key of its type. */
    @Field()
    module!: string

    /** The display name. */
    @Field()
    name!: string

    /** The mention handle. */
    @Field()
    handle!: string

    /** The role line. */
    @Field()
    role!: string

    /** The standing instructions. */
    @Field()
    instructions!: string

    /** The knowledge text. */
    @Field()
    knowledge!: string

    /** The greeting. */
    @Field()
    greeting!: string

    /** The approval rule text. */
    @Field()
    approvalRule!: string

    /** `active` or `paused`. */
    @Field()
    status!: string

    /** When it was created, ISO 8601. */
    @Field()
    createdAt!: string
}
