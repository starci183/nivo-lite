import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent access to a connection. */
export class ConnectionGrantType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** `read`, `ask` or `auto`. */
    @Field(() => String)
    access!: string
}
