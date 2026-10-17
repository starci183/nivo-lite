import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import { ACCESS_LEVELS } from "@modules/domain/connection-grants"
import type { Access } from "@modules/domain/agent-connections"

@InputType()
/** One connection wanted for an agent. */
export class ConnectionWishInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The level when the caller picks one. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(8)
    @IsIn(ACCESS_LEVELS)
    access?: Access
}
