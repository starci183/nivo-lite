import { Field, ID, InputType } from "@nestjs/graphql"
import { UndefinedAsNull } from "@modules/platform/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"

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

    /** Any level binds the agent, nothing removes the binding; the level itself is ignored (rights live in the agent's attachments). */
    @Field(() => String, { nullable: true })
    @UndefinedAsNull()
    @IsOptional()
    @IsString()
    @MaxLength(8)
    @IsIn(["read", "ask", "auto"])
    access!: string | null
}
