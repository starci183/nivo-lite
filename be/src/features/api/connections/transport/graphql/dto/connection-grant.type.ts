import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent bound to a connection. */
export class ConnectionGrantType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** Deprecated: always `auto` for a bound pair (rights live in the agent's attachments). */
    @Field(() => String, { deprecationReason: "Rights live in the agent's attachments (tab Quyền); a binding has no level. Always \"auto\" for a bound pair; removed next release." })
    access!: string
}
