import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One document of a workspace as the Knowledge page lists it, without its text. */
export class KnowledgeSourceType {
    /** The document id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns it. */
    @Field(() => ID)
    workspaceId!: string

    /** The module (agent type) it is for; null = every module. */
    @Field(() => String, { nullable: true })
    module?: string | null

    /** The agent instance that alone reads it; null = every instance. */
    @Field(() => ID, { nullable: true })
    installationId?: string | null

    /** `text`, `faq`, `file` or `url`. */
    @Field(() => String)
    kind!: string

    /** The topic label. */
    @Field(() => String, { nullable: true })
    topic?: string | null

    /** The tags. */
    @Field(() => [String])
    tags!: Array<string>

    /** `public` (customer-facing agents may answer from it) or `internal`. */
    @Field(() => String)
    visibility!: string

    /** The title. */
    @Field(() => String)
    title!: string

    /** Where it stands: `queued`, `reading`, `indexing`, `extracting_facts`, `ready`, `failed` or `blocked_credits`. */
    @Field(() => String)
    status!: string

    /** A stored code or note the page shows its own text for, or null. */
    @Field(() => String, { nullable: true })
    error?: string | null

    /** How many passages are stored. */
    @Field(() => Int)
    chunkCount!: number

    /** The raw bytes it holds: the uploaded file, or the pasted text. */
    @Field(() => Int)
    sizeBytes!: number

    /** 0 to 100 while a worker is on it. */
    @Field(() => Int)
    progress!: number

    /** When it was added, ISO 8601. */
    @Field(() => String)
    createdAt!: string

    /** When it last changed, ISO 8601. */
    @Field(() => String)
    updatedAt!: string
}
