import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An agent another agent may pass work to. */
export class AgentTagTargetType {
    /** The agent. */
    @Field(() => ID)
    id!: string

    /** The display name. */
    @Field()
    name!: string

    /** The module. */
    @Field()
    module!: string

    /** `active` or `paused`. */
    @Field()
    status!: string
}
