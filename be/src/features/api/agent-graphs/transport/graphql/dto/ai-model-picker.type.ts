import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One choice of the node drawer's model picker. */
export class AiModelChoiceType {
    /** What the node stores: `auto` or a model id. */
    @Field(() => String)
    id!: string

    /** The name shown. */
    @Field(() => String)
    label!: string

    /** The line under the name. */
    @Field(() => String)
    hint!: string

    /** The provider of an explicit model (`anthropic`, `openrouter`); null for Auto. */
    @Field(() => String, { nullable: true })
    provider!: string | null

    /** The provider's chip text (`Anthropic`, `OpenRouter`); null for Auto. */
    @Field(() => String, { nullable: true })
    providerLabel!: string | null

    /** False while the provider holds no key in this deployment; Auto is always true. */
    @Field(() => Boolean)
    available!: boolean
}

@ObjectType()
/** What blocks-core declares for one node step that calls AI. */
export class AiNodeModelType {
    /** The node step id (`accounting.match-payment`). */
    @Field(() => String)
    nodeId!: string

    /** `auto` or a model id: the drawer's choice when the graph's node names none. */
    @Field(() => String)
    model!: string

    /** `light` or `heavy`: what Auto reads. */
    @Field(() => String)
    weight!: string
}

@ObjectType()
/** The node drawer's model picker. */
export class AiModelPickerType {
    /** Auto first, then the explicit models strongest first. */
    @Field(() => [AiModelChoiceType])
    choices!: ReadonlyArray<AiModelChoiceType>

    /** The model of a node that declares none. */
    @Field(() => String)
    defaultModel!: string

    /** Every node step that calls AI; a step not listed shows no picker. */
    @Field(() => [AiNodeModelType])
    nodes!: ReadonlyArray<AiNodeModelType>
}
