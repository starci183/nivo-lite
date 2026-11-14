import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An account attached to the agent whose provider refused the credential: the owner connects it again; its sends fail until then. */
export class AgentWorkflowReconnectType {
    /** The provider, by key (`zalo_oa`, `sepay`). */
    @Field(() => String)
    provider!: string

    /** The attached account that needs connecting again. */
    @Field(() => ID)
    connectionId!: string
}
