import { Field, ID, ObjectType } from "@nestjs/graphql"
import { SimulationEventType } from "./simulation-event.type"
import { SimulationWorkItemType } from "./simulation-work-item.type"

@ObjectType()
/** The authoritative queue state and result of a simulated input. */
export class InboundSimulationStatusType {
    /** The event identity used by the status query. */
    @Field(() => ID)
    id!: string

    /** queued, running, succeeded or failed. */
    @Field()
    status!: string

    /** A stable failure code, when the job or work failed. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** The received input, refreshed after department processing. */
    @Field(() => SimulationEventType)
    event!: SimulationEventType

    /** The first department's work, when it has started. */
    @Field(() => SimulationWorkItemType, { nullable: true })
    workItem!: SimulationWorkItemType | null
}
