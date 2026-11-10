import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent bound to a connection. */
export class ConnectionGrantType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string
}
