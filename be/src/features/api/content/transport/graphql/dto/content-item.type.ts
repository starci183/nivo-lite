import { Field, ObjectType, ID } from "@nestjs/graphql"
import { ContentVariantType } from "./content-variant.type"
import { ContentItemMediaType } from "./content-item-media.type"
import { ContentLinkType } from "./content-link.type"
import { ContentEvidenceType } from "./content-evidence.type"
import { ContentPublishedMarkType } from "./content-published-mark.type"

@ObjectType()
/** A content post with every field needed by the editor. */
export class ContentItemType {
    /** The content item id. */
    @Field(() => ID)
    id!: string

    /** The workspace that owns the post. */
    @Field(() => ID)
    workspaceId!: string

    /** The editorial plan that created the post, when there was one. */
    @Field(() => ID, { nullable: true })
    planId!: string | null

    /** The post title. */
    @Field()
    title!: string

    /** The drafting brief. */
    @Field()
    brief!: string

    /** The content theme, when selected. */
    @Field(() => ID, { nullable: true })
    pillarId!: string | null

    /** The social channels the post targets. */
    @Field(() => [String])
    channels!: Array<string>

    /** The scheduled instant, ISO 8601. */
    @Field(() => String, { nullable: true })
    scheduledAt!: string | null

    /** The current editorial status. */
    @Field()
    status!: string

    /** The channel-specific draft texts. */
    @Field(() => [ContentVariantType])
    variants!: Array<ContentVariantType>

    /** The common hashtags. */
    @Field(() => [String])
    hashtags!: Array<string>

    /** The attachments of this post. */
    @Field(() => [ContentItemMediaType])
    media!: Array<ContentItemMediaType>

    /** The supporting links. */
    @Field(() => [ContentLinkType])
    links!: Array<ContentLinkType>

    /** The occasion used when planning this post. */
    @Field(() => String, { nullable: true })
    holidayKey!: string | null

    /** The post history. */
    @Field(() => [ContentEvidenceType])
    evidence!: Array<ContentEvidenceType>

    /** The channels posted manually and their proof. */
    @Field(() => [ContentPublishedMarkType])
    published!: Array<ContentPublishedMarkType>

    /** The related approval task, when created. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** When the post was drafted, ISO 8601. */
    @Field(() => String, { nullable: true })
    draftedAt!: string | null

    /** The audit name of the person who approved the post. */
    @Field(() => String, { nullable: true })
    approvedBy!: string | null

    /** When the post was approved, ISO 8601. */
    @Field(() => String, { nullable: true })
    approvedAt!: string | null

    /** When publication was completed, ISO 8601. */
    @Field(() => String, { nullable: true })
    publishedAt!: string | null

    /** Where the post originated. */
    @Field()
    source!: string

    /** The audit name of the creator. */
    @Field()
    createdBy!: string

    /** When the post was created, ISO 8601. */
    @Field()
    createdAt!: string

    /** When the post was last updated, ISO 8601. */
    @Field()
    updatedAt!: string
}
