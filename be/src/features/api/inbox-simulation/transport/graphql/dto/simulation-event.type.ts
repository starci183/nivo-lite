import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The received input facts shown in the simulator's result notice. */
export class SimulationEventType {
    /** The stored inbound event. */
    @Field(() => ID)
    id!: string

    /** The channel's own event identity. */
    @Field()
    eventId!: string

    /** The number of repeated deliveries. */
    @Field(() => Int)
    duplicateCount!: number

    /** The amount in whole VND, when supplied. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The lead produced by the work, when any. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The received event's recorded state. */
    @Field()
    status!: string
}
