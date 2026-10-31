import { Field, ID, InputType } from "@nestjs/graphql"
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator"
import type { AgentTriggerKind, AgentTriggerPreset } from "@modules/domain/agent-work"

@InputType()
/** Adds a trigger to an agent or changes one. */
export class SaveAgentTriggerInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The trigger to change; absent or null for a new one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    triggerId: string | null = null

    /** schedule or event. */
    @Field()
    @IsIn(["schedule", "event"])
    kind!: AgentTriggerKind

    /** every_15m, hourly, daily_at or weekdays_at, for a clock. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["every_15m", "hourly", "daily_at", "weekdays_at"])
    preset: AgentTriggerPreset | null = null

    /** The time of day (HH:MM), for the daily presets. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(5)
    atTime: string | null = null

    /** The zone of the time of day; the default when absent. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timeZone: string | null = null

    /** The internal event, for an event trigger. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    eventName: string | null = null

    /** The probe that decides whether there is work. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    probeKey: string | null = null

    /** Off keeps the trigger and fires nothing. */
    @Field(() => Boolean)
    @IsBoolean()
    enabled!: boolean
}
