import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The graph of one agent as the editor opens it. The graph, its problems, gaps, cards and proposals travel as JSON text. */
export class AgentGraphType {
    /** The agent. */
    @Field(() => String)
    agentId!: string

    /** The installation the agent runs as. */
    @Field(() => String)
    installationId!: string

    /** shadow records only, enforced decides. */
    @Field(() => String)
    mode!: string

    /** The revision of the draft; a save names the revision it read. */
    @Field(() => Int)
    draftRev!: number

    /** The version that decides, or null before the first. */
    @Field(() => String, { nullable: true })
    activeVersionId!: string | null

    /** The draft graph as JSON text: { nodes, rights }. */
    @Field(() => String)
    draftJson!: string

    /** What is still vague, in the order the setup chat asks, as JSON text. */
    @Field(() => String)
    gapsJson!: string

    /** What the owner must fix before publishing, as JSON text. */
    @Field(() => String)
    problemsJson!: string

    /** Each node as a card (id, label, description, tone, shape, count, isPlaceholder), as JSON text. */
    @Field(() => String)
    cardsJson!: string

    /** The proposals waiting for a person, as JSON text. */
    @Field(() => String)
    proposalsJson!: string
}
