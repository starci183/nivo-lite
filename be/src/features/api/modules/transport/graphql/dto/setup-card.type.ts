import { Field, ID, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** One confirm card of the setup chat: a Second Brain fact or an authority rule the owner decides. */
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

    /** `fact` or `rule`. */
    @Field()
    kind!: string

    /** `proposed`, `applied`, `rejected` or `superseded`. */
    @Field()
    status!: string

    /** The fact (subject, attribute, value, scope) or the rule (action, field, mode, limit). */
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
