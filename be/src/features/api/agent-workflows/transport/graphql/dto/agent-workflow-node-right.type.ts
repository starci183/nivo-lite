import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A title in the owner's two languages, as the installed node or the plugin declares it. */
export class AgentWorkflowTitleType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}

@ObjectType()
/** One operation a node of a workflow version asks to call on a connected account, as its graph states it. */
export class AgentWorkflowNodeRightType {
    /** The key of the node. */
    @Field(() => String)
    nodeKey!: string

    /** The kind of the account (messaging, payment, books, mail, records). */
    @Field(() => String)
    kind!: string

    /** The provider of the account, or null for any provider of the kind. */
    @Field(() => String, { nullable: true })
    provider!: string | null

    /** The connected account, or null while a template leaves it unbound. */
    @Field(() => ID, { nullable: true })
    connectionId!: string | null

    /** The operation, by tool id. */
    @Field(() => String)
    operation!: string

    /** auto or ask. */
    @Field(() => String)
    mode!: string

    /** The title of the step the node runs, as its installed node declares it; null for a step no installed node is. */
    @Field(() => AgentWorkflowTitleType, { nullable: true })
    stepTitle!: AgentWorkflowTitleType | null

    /** The title of the operation, as its plugin or its provider's ability declares it; null when none does (show the id). */
    @Field(() => AgentWorkflowTitleType, { nullable: true })
    operationTitle!: AgentWorkflowTitleType | null
}
