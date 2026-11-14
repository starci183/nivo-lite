import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What one consent over an agent's running workflows did. */
export class AgentNodeRightsAgreedType {
    /** False while the agents' ticks decide the workspace: nothing waits on a node row there, and the call did nothing. */
    @Field(() => Boolean)
    nodeRightsDecide!: boolean

    /** How many grant rows the consent wrote. */
    @Field(() => Int)
    agreed!: number
}
