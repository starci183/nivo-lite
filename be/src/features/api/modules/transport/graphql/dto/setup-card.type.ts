import { Field, ID, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** One confirm card of the setup chat: a Second Brain fact the owner decides. */
export class SetupCardType {
    /** The card. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The session it belongs to. */
    @Field(() => ID)
    setupSessionId!: string

    /** The owner message it came from. */
    @Field(() => ID, { nullable: true })
    sourceMessageId?: string | null

    /** The gate it answers. */
    @Field()
    gateKey!: string

    /** The target: one waiting card per target. */
    @Field()
    targetKey!: string

    /** Always `fact`. */
    @Field()
    kind!: string

    /** `proposed`, `applied`, `rejected` or `superseded`. */
    @Field()
    status!: string

    /** The fact (subject, attribute, value, scope). */
    @Field(() => GraphqlJsonObject)
    payload!: object

    /** What the card did once decided. */
    @Field(() => GraphqlJsonObject, { nullable: true })
    result?: object | null

    /** Who decided it. */
    @Field(() => String, { nullable: true })
    decidedBy?: string | null

    /** When it was proposed, ISO 8601. */
    @Field()
    createdAt!: string
}
