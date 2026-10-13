import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The immediate receipt of a simulation request. */
export class SimulateInboundType {
    /** The stored inbound event, passed to the status query. */
    @Field(() => ID)
    id!: string

    /** queued, running, succeeded or failed. */
    @Field()
    status!: string

    /** True when this delivery repeated an existing input. */
    @Field()
    duplicate!: boolean
}
