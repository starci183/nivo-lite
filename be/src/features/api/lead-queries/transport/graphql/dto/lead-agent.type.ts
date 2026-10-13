import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A workspace agent available to own the customer's next action. */
export class LeadAgentType {
    /** The agent id. */
    @Field(() => ID)
    id!: string

    /** The agent's display name. */
    @Field()
    name!: string

    /** The handle used to mention the agent. */
    @Field()
    handle!: string

    /** The agent's current status. */
    @Field()
    status!: string

    /** The module the agent belongs to. */
    @Field()
    module!: string
}
