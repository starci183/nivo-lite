import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What copying the setup of a sibling carried over to the new agent. */
export class CopiedSetupType {
    /** The installation the setup came from. */
    @Field(() => ID)
    fromInstallationId!: string

    /** The settings and the operating mode came over. */
    @Field()
    settings!: boolean

    /** The applied setup version came over (the agent reads as ready). */
    @Field()
    contextVersion!: boolean

    /** How many permission rules now list the new agent too. */
    @Field(() => Int)
    rules!: number

    /** The graph version: copied, refused (the checks refused it, the seed stays) or none. */
    @Field()
    graph!: string

    /** How many shared connections (data sources, tools) were granted like the sibling's; channels never come over. */
    @Field(() => Int)
    connections!: number

    /** How many facts kept for the sibling alone were copied as the new agent's own private facts. */
    @Field(() => Int)
    knowledgeFacts!: number

    /** How many documents kept for the sibling alone were copied as the new agent's own private documents. */
    @Field(() => Int)
    knowledgeDocuments!: number

    /** How many private facts of the sibling still wait for approval and stayed there. */
    @Field(() => Int)
    knowledgeWaiting!: number
}

@ObjectType()
/** What creating one more agent of a role answers. */
export class CreatedAgentInstallationType {
    /** The new installation. */
    @Field(() => ID)
    installationId!: string

    /** Its agent. */
    @Field(() => ID)
    agentId!: string

    /** What the copy carried over; null for the default setup. */
    @Field(() => CopiedSetupType, { nullable: true })
    copied!: CopiedSetupType | null

    /** How many channels the agent now answers. */
    @Field(() => Int)
    channels!: number
}
