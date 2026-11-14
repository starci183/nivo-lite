import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Words in the owner's two languages, as a registry declares them. */
export class NodeRightWordsType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}

@ObjectType()
/** One operation of a provider as a rights row names it. */
export class NodeRightOperationType {
    /** The operation id: the full tool id. */
    @Field(() => String)
    id!: string

    /** Its name in the owner's two languages, when a plugin labels it; else null (the page shows the id). */
    @Field(() => NodeRightWordsType, { nullable: true })
    title!: NodeRightWordsType | null

    /** The HTTP method of its operation, for a tool of the OpenAPI provider whose account pinned a document; else null. */
    @Field(() => String, { nullable: true })
    method!: string | null

    /** The path of its operation; else null. */
    @Field(() => String, { nullable: true })
    path!: string | null

    /** read or write (every operation is a tool: there is no work action). */
    @Field(() => String)
    kind!: string

    /** The effect the provider marks on it (money, irreversible, none), or null when it marks none. */
    @Field(() => String, { nullable: true })
    effect!: string | null
}
