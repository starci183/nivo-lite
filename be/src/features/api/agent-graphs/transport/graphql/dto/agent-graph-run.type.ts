import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One run of the graph of an agent over a work item. The facts and the nodes it went through travel as JSON text. */
export class AgentGraphRunType {
    /** The decision. */
    @Field(() => String)
    decisionId!: string

    /** The agent. */
    @Field(() => String)
    agentId!: string

    /** The version that decided. */
    @Field(() => String)
    versionId!: string

    /** The number of that version. */
    @Field(() => Number)
    version!: number

    /** The trigger that woke the agent: customer_message, tag, event or schedule; null when the wake is gone. */
    @Field(() => String, { nullable: true })
    trigger!: string | null

    /** The branch the condition took. */
    @Field(() => String)
    branchKey!: string

    /** What the branch did: auto, ask or stop. */
    @Field(() => String)
    outcome!: string

    /** How the work ended: done, approved, edited, rejected or expired; null while it is open. */
    @Field(() => String, { nullable: true })
    closedAs!: string | null

    /** True when the graph, in shadow, answered differently from the gate. */
    @Field(() => Boolean)
    shadowDiff!: boolean

    /** The request that is open for it, or null. */
    @Field(() => String, { nullable: true })
    approvalRequestId!: string | null

    /** The facts as they were read, as JSON text. */
    @Field(() => String)
    factsJson!: string

    /** The nodes the work went through, in order, as JSON text: key, title, kind, step and the branch taken on a condition. */
    @Field(() => String)
    traceJson!: string
}
