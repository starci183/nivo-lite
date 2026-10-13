import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One installed agent, as the console menus draw it. */
export class ShellAgentType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** The agent name. */
    @Field()
    name!: string

    /** The module the agent belongs to. */
    @Field()
    module!: string

    /** `active` or `paused`. */
    @Field()
    status!: string
}
