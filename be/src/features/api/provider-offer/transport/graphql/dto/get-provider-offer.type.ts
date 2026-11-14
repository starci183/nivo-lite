import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Words in the owner's two languages, exactly as a registry declares them. */
export class ProviderOfferWordsType {
    /** Vietnamese. */
    @Field(() => String)
    vi!: string

    /** English. */
    @Field(() => String)
    en!: string
}

@ObjectType()
/** One member of a parameter list, a returned record or a trigger payload. */
export class ProviderOfferMemberType {
    /** Its name, as a caller sends it or a reader finds it. */
    @Field(() => String)
    name!: string

    /** Its JSON type as the schema declares it (`string`, `string|null`, `array<object>`; `id`, `integer`, `choice` for a trigger), or null. */
    @Field(() => String, { nullable: true })
    type!: string | null

    /** Its JSON format (`uuid`, `date-time`), or null. */
    @Field(() => String, { nullable: true })
    format!: string | null

    /** True when the caller must send it; always true for a trigger payload member. */
    @Field(() => Boolean)
    required!: boolean

    /** The closed values it takes; empty when it is no closed choice. */
    @Field(() => [String])
    choices!: ReadonlyArray<string>

    /** What it means in the owner's two languages, when the registry declares that (trigger payloads); else null. */
    @Field(() => ProviderOfferWordsType, { nullable: true })
    label!: ProviderOfferWordsType | null

    /** What it means in the one language its schema declares, or null. */
    @Field(() => String, { nullable: true })
    description!: string | null

    /** True when a workflow's trigger filter may compare it. */
    @Field(() => Boolean)
    filterable!: boolean
}

@ObjectType()
/** One read of level 1: a screen calls it at the person-read door by its name. */
export class ProviderOfferReadType {
    /** The door name `<provider>:<read>`. */
    @Field(() => String)
    name!: string

    /** `read` (level 1 has no write yet) or `write`. */
    @Field(() => String)
    kind!: string

    /** `page`, `record` or `info`. */
    @Field(() => String)
    shape!: string

    /** `live` (read from the outside system at the call) or `synced` (from what NIVO stored at its last sync). */
    @Field(() => String)
    freshness!: string

    /** One line of what it answers, when the registry declares one; else null. */
    @Field(() => ProviderOfferWordsType, { nullable: true })
    summary!: ProviderOfferWordsType | null

    /** The members of its input. */
    @Field(() => [ProviderOfferMemberType])
    parameters!: ReadonlyArray<ProviderOfferMemberType>

    /** The members of one row (`page`) or of the record; empty when the provider does not say. */
    @Field(() => [ProviderOfferMemberType])
    returns!: ReadonlyArray<ProviderOfferMemberType>
}

@ObjectType()
/** How a Swagger tool stands against the account's pinned OpenAPI document. */
export class ProviderOfferOperationType {
    /** The HTTP method, or null when the document has no such operation. */
    @Field(() => String, { nullable: true })
    method!: string | null

    /** The path, or null when the document has no such operation. */
    @Field(() => String, { nullable: true })
    path!: string | null

    /** `ready`, `missing`, `unsupported` or `mode_mismatch`. */
    @Field(() => String)
    state!: string

    /** The unsupported features of its operation, by name. */
    @Field(() => [String])
    unsupported!: ReadonlyArray<string>
}

@ObjectType()
/** One tool of level 2: an agent calls it through the gateway. */
export class ProviderOfferToolType {
    /** The full tool id. */
    @Field(() => String)
    id!: string

    /** `read` or `write`. */
    @Field(() => String)
    kind!: string

    /** The effect the provider marks (`money`, `irreversible`, `none`), or null when none is declared. */
    @Field(() => String, { nullable: true })
    effect!: string | null

    /** Its name in the owner's two languages, when a plugin labels it; else null. */
    @Field(() => ProviderOfferWordsType, { nullable: true })
    title!: ProviderOfferWordsType | null

    /** What it lets an agent do, one line, when a plugin labels it; else null. */
    @Field(() => ProviderOfferWordsType, { nullable: true })
    summary!: ProviderOfferWordsType | null

    /** What it does in the one language of its gateway spec, or null. */
    @Field(() => String, { nullable: true })
    description!: string | null

    /** The members of its arguments. */
    @Field(() => [ProviderOfferMemberType])
    parameters!: ReadonlyArray<ProviderOfferMemberType>

    /** The members of its answer, when declared; else empty. */
    @Field(() => [ProviderOfferMemberType])
    returns!: ReadonlyArray<ProviderOfferMemberType>

    /** How it stands against the pinned document (OpenAPI provider with a pin); else null. */
    @Field(() => ProviderOfferOperationType, { nullable: true })
    operation!: ProviderOfferOperationType | null
}

@ObjectType()
/** How the events of one emission are grouped into runs. */
export class ProviderOfferBatchingType {
    /** `each` (one run per event) or `list` (one run per emission with the event ids). */
    @Field(() => String)
    mode!: string

    /** The most events one `list` run takes; null for `each`. */
    @Field(() => Int, { nullable: true })
    maxEvents!: number | null
}

@ObjectType()
/** One trigger of level 3: the provider's background work emits it and a workflow may register on it. */
export class ProviderOfferTriggerType {
    /** Its name inside the provider. */
    @Field(() => String)
    name!: string

    /** `webhook` or `poll`. */
    @Field(() => String)
    kind!: string

    /** What it is, in the owner's two languages. */
    @Field(() => ProviderOfferWordsType)
    summary!: ProviderOfferWordsType

    /** The members of one event's payload. */
    @Field(() => [ProviderOfferMemberType])
    payload!: ReadonlyArray<ProviderOfferMemberType>

    /** How events are grouped into runs. */
    @Field(() => ProviderOfferBatchingType)
    batching!: ProviderOfferBatchingType

    /** `cursor`, `reconcile` or `none`: how a missed event is recovered. */
    @Field(() => String)
    recovery!: string

    /** True when one agent decides on its events and every other registered one is only told. */
    @Field(() => Boolean)
    decided!: boolean
}

@ObjectType()
/** What the provider of a connected account offers at its three levels; a level it lacks is an empty list. */
export class ProviderOfferType {
    /** The connected account asked about. */
    @Field(() => ID)
    connectionId!: string

    /** Its provider key. */
    @Field(() => String)
    provider!: string

    /** Level 1: the reads a screen may call. */
    @Field(() => [ProviderOfferReadType])
    api!: ReadonlyArray<ProviderOfferReadType>

    /** Level 2: the tools an agent may call. */
    @Field(() => [ProviderOfferToolType])
    mcp!: ReadonlyArray<ProviderOfferToolType>

    /** Level 3: the triggers its background work emits. */
    @Field(() => [ProviderOfferTriggerType])
    triggers!: ReadonlyArray<ProviderOfferTriggerType>
}
