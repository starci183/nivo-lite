import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One operation a node of a template version asks for on an account, before any install. */
export class TemplateNodeRequestType {
    /** The key of the node. */
    @Field(() => String)
    nodeKey!: string

    /** The kind of account (messaging, payment, books, mail, records). */
    @Field(() => String)
    kind!: string

    /** The provider, or null for any provider of the kind. */
    @Field(() => String, { nullable: true })
    provider!: string | null

    /** The operation, by tool (or action) id. */
    @Field(() => String)
    operation!: string

    /** auto or ask: the mode the template asks for. */
    @Field(() => String)
    mode!: string
}

@ObjectType()
/** What a template version's nodes ask for on accounts, for the review before an agent is created. */
export class AgentTemplateNodeRequestsType {
    /** The template. */
    @Field(() => String)
    templateId!: string

    /** The version read. */
    @Field(() => Int)
    version!: number

    /** One row per node, account entry and operation, as the template states them. */
    @Field(() => [TemplateNodeRequestType])
    rights!: ReadonlyArray<TemplateNodeRequestType>

    /** How many rows. */
    @Field(() => Int)
    count!: number

    /** How many of them wait for a person at each call (ask). */
    @Field(() => Int)
    askCount!: number
}
