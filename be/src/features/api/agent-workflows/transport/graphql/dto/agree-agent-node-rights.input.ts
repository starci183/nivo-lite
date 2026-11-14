import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
    MinLength,
    ValidateNested,
} from "class-validator"

@InputType()
/**
 * The owner's pick of the ONE source of a stream two attached accounts read for one trigger purpose of a running workflow, as readiness
 * names it (`blocked[].reason = needs_pick`: its `verb` and `stream` are copied as they stand, `connectionId` is one of its `connectionIds`):
 * the other account then wakes nothing.
 */
export class AgentTriggerPickInput {
    /** The workflow whose trigger the pick is for. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workflowId!: string

    /** The trigger purpose, exactly as readiness named it (`blocked[].verb`, `nivo.trigger.payment.credit.received`). */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    verb!: string

    /** The stream, exactly as readiness named it (`bank-account:VCB:0123456789`). */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(300)
    stream!: string

    /** The account picked: one of the accounts readiness named for the stream. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    connectionId!: string
}

@InputType()
/** What agreeAgentNodeRights takes. */
export class AgreeAgentNodeRightsInput {
    /** The installation whose agent holds the workflows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /**
     * The owner's picks of one source per contested stream (owner only); absent or empty when none is picked. A pick that names a
     * stream the accounts do not contest, or an account outside it, refuses the whole call (AGENT_GRAPHS_TRIGGER_PICK_REFUSED).
     */
    @Field(() => [AgentTriggerPickInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => AgentTriggerPickInput)
    triggerPicks?: Array<AgentTriggerPickInput> | null
}
