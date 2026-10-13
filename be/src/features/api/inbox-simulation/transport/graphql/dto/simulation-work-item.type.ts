import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The first department's work for a simulated input. */
export class SimulationWorkItemType {
    /** The work item. */
    @Field(() => ID)
    id!: string

    /** The department to label in the notice. */
    @Field()
    department!: string

    /** The work state, including waiting_decision. */
    @Field()
    status!: string
}
