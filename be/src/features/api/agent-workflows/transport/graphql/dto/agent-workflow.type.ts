import { Field, Int, ObjectType } from "@nestjs/graphql"
import { AgentWorkflowReadinessType } from "./agent-workflow-readiness.type"

@ObjectType()
/** One workflow of an agent: a named graph with its own version history. */
export class AgentWorkflowType {
    /** The workflow. */
    @Field(() => String)
    id!: string

    /** The stable key within the agent. */
    @Field(() => String)
    key!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** active, draft or paused. */
    @Field(() => String)
    status!: string

    /** Whether it is the agent's main workflow. */
    @Field(() => Boolean)
    primary!: boolean

    /** The number of the version that runs, or null. */
    @Field(() => Int, { nullable: true })
    activeNumber!: number | null

    /** The newest version number. */
    @Field(() => Int)
    latestNumber!: number

    /** The template it came from, or null for one made from scratch. */
    @Field(() => String, { nullable: true })
    templateId!: string | null

    /** The template version it copied or last accepted, or null. */
    @Field(() => Int, { nullable: true })
    templateVersion!: number | null

    /** The template's name, or null. */
    @Field(() => String, { nullable: true })
    templateName!: string | null

    /** The template's newest version, or null. */
    @Field(() => Int, { nullable: true })
    templateLatest!: number | null

    /** How many steps the version that runs differs from its template version, or null. */
    @Field(() => Int, { nullable: true })
    templateChangedSteps!: number | null

    /** How many steps the version that runs has. */
    @Field(() => Int)
    stepCount!: number

    /** When it last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string

    /** Whether its graph shows for the agent, read by the agentWorkflows list; null where it is not read (a single write's answer). */
    @Field(() => AgentWorkflowReadinessType, { nullable: true })
    readiness?: AgentWorkflowReadinessType | null
}
