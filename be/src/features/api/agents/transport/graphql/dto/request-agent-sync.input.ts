import { NullAsAbsent } from "@modules/platform/graphql"
import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** Rebuilds the OpenClaw copy of the agents. */
export class RequestAgentSyncInput {
    /** The one instance to sync; the whole workspace when absent. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsUUID("4")
    @MaxLength(36)
    installationId?: string

    /** Also sync an instance that is not on OpenClaw yet. */
    @Field(() => Boolean, { nullable: true })
    @IsOptional()
    @NullAsAbsent()
    @IsBoolean()
    force?: boolean
}
