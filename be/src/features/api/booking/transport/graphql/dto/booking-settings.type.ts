import { Field, ObjectType, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking settings view. */
export class BookingSettingsType {
    /** The timezone. */
    @Field(() => String)
    timezone!: string

    /** The slot step min. */
    @Field(() => Int)
    slotStepMin!: number

    /** The min lead min. */
    @Field(() => Int)
    minLeadMin!: number

    /** The max advance days. */
    @Field(() => Int)
    maxAdvanceDays!: number

    /** The cancel window hours. */
    @Field(() => Int)
    cancelWindowHours!: number

    /** The deposit pct. */
    @Field(() => Int)
    depositPct!: number

    /** The late cancel fee pct. */
    @Field(() => Int)
    lateCancelFeePct!: number

    /** The no show fee vnd. */
    @Field(() => Float)
    noShowFeeVnd!: number

    /** The auto confirm. */
    @Field(() => Boolean)
    autoConfirm!: boolean

    /** The handoff order. */
    @Field(() => Boolean)
    handoffOrder!: boolean

    /** The reminder hours. */
    @Field(() => [Float])
    reminderHours!: ReadonlyArray<number>

    /** The public enabled. */
    @Field(() => Boolean)
    publicEnabled!: boolean

    /** The public slug. */
    @Field(() => String, { nullable: true })
    publicSlug!: string | null

    /** The public note. */
    @Field(() => String)
    publicNote!: string

    /** The address. */
    @Field(() => String)
    address!: string
}
