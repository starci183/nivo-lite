import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One trigger of an agent. */
export class AgentTriggerType {
    /** The trigger. */
    @Field(() => ID)
    id!: string

    /** schedule or event. */
    @Field()
    kind!: string

    /** every_15m, hourly, daily_at or weekdays_at, for a clock. */
    @Field(() => String, { nullable: true })
    preset!: string | null

    /** The time of day (HH:MM), for the daily presets. */
    @Field(() => String, { nullable: true })
    atTime!: string | null

    /** The zone of the time of day. */
    @Field()
    timeZone!: string

    /** The internal event, for an event trigger. */
    @Field(() => String, { nullable: true })
    eventName!: string | null

    /** The probe that decides whether there is work. */
    @Field(() => String, { nullable: true })
    probeKey!: string | null

    /** Off means the trigger stays and fires nothing. */
    @Field(() => Boolean)
    enabled!: boolean

    /** The stable key a module seeded it under, or null. */
    @Field(() => String, { nullable: true })
    seedKey!: string | null

    /** The next slot the scheduler holds, ISO 8601, or null. */
    @Field(() => Date, { nullable: true })
    nextRunAt!: Date | null

    /** The last slot that fired, ISO 8601, or null. */
    @Field(() => Date, { nullable: true })
    lastFiredAt!: Date | null
}
