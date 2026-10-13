import { Field, ID, InputType } from "@nestjs/graphql"
import { Transform } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import { IsBoolean, IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Rebuilds the OpenClaw copy of the agents. */
export class RequestAgentSyncInput {
    /** The one instance to sync; the whole workspace when absent. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string

    /** Also sync an instance that is not on OpenClaw yet. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsBoolean()
    force?: boolean
}
