import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql"

/** What an owner may answer a waiting decision. */
export const AgentRunDecisionVerdict = { approve: "approve", retry: "retry", reject: "reject" }

registerEnumType(AgentRunDecisionVerdict, { name: "AgentRunDecisionVerdict" })

@ObjectType()
/** The decision a run waits on, answerable on the run page. */
export class AgentRunDecisionType {
    /** The decision to answer: the open request of the approval road, else the work item. */
    @Field(() => ID)
    decisionId!: string

    /** The work item that waits. */
    @Field(() => ID)
    workItemId!: string

    /** The step that waits on it, or null when the run is only about the item. */
    @Field(() => String, { nullable: true })
    stepKey!: string | null

    /** What is decided, in one sentence. */
    @Field()
    title!: string

    /** The answers offered, the one that goes on first. */
    @Field(() => [AgentRunDecisionVerdict])
    options!: ReadonlyArray<string>
}
