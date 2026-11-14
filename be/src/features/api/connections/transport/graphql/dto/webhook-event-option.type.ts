import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A text in both product languages. */
export class WebhookEventTextType {
    /** The Vietnamese text. */
    @Field()
    vi!: string

    /** The English text. */
    @Field()
    en!: string
}

@ObjectType()
/** One outgoing event a webhook receiver may pick. */
export class WebhookEventOptionType {
    /** The event id (`<domain>.<verb>`) a receiver filters on. */
    @Field()
    id!: string

    /** The name the owner reads. */
    @Field(() => WebhookEventTextType)
    label!: WebhookEventTextType

    /** When it fires, or null. */
    @Field(() => WebhookEventTextType, { nullable: true })
    summary!: WebhookEventTextType | null
}
