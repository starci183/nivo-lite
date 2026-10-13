import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { ACCESS_LEVELS } from "@modules/domain/connection-grants"
import type { Access } from "@modules/domain/agent-connections"

@InputType()
/** One agent wanted on a connection. */
export class GrantWishInput {
    /** The agent. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    agentId!: string

    /** The level when the caller picks one. */
    @Field(() => String, { nullable: true })
    @Transform(({ value }) => value ?? undefined)
    @IsOptional()
    @IsString()
    @MaxLength(8)
    @IsIn(ACCESS_LEVELS)
    access?: Access
}
