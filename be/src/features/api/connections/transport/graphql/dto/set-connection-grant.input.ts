import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { ACCESS_LEVELS } from "@modules/domain/connection-grants"
import type { Access } from "@modules/domain/agent-connections"

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

    /** The level, or nothing to remove the access. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? null)
    @IsOptional()
    @IsString()
    @MaxLength(8)
    @IsIn(ACCESS_LEVELS)
    access!: Access | null
}
