import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsUUID, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of setConnectionGrant. */
export class SetConnectionGrantInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The agent. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    agentId!: string

    /** True binds the agent to the connection, false removes the binding (a binding has no level: rights live in attachments). */
    @Field(() => Boolean)
    @IsBoolean()
    bound!: boolean
}
