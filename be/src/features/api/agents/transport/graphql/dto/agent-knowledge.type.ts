import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { AgentKnowledgeDocumentType } from "./agent-knowledge-document.type"
import { AgentKnowledgeLayerType } from "./agent-knowledge-layer.type"
import { AgentKnowledgeOwnFactType } from "./agent-knowledge-own-fact.type"

@ObjectType()
/** What one agent reads of the shared knowledge: the layers, the documents, the facts that wait and the facts only it reads. */
export class AgentKnowledgeType {
    /** The agent. */
    @Field(() => ID)
    agentId!: string

    /** The module of the agent. */
    @Field()
    module!: string

    /** The display name of the agent. */
    @Field()
    name!: string

    /** The instance the view is scoped to. */
    @Field(() => ID, { nullable: true })
    installationId?: string | null

    /** `customer` or `internal`. */
    @Field()
    audience!: string

    /** How many facts wait for the owner and would be read once approved. */
    @Field(() => Int)
    waitingFacts!: number

    /** Public, internal and restricted. */
    @Field(() => [AgentKnowledgeLayerType])
    layers!: Array<AgentKnowledgeLayerType>

    /** The documents that apply to the agent. */
    @Field(() => [AgentKnowledgeDocumentType])
    documents!: Array<AgentKnowledgeDocumentType>

    /** The facts only this agent reads. */
    @Field(() => [AgentKnowledgeOwnFactType])
    ownFacts!: Array<AgentKnowledgeOwnFactType>
}
