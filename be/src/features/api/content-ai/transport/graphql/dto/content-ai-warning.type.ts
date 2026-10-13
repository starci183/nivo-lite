import { Field, ObjectType } from "@nestjs/graphql"
import { ContentAiWarningDetailType } from "./content-ai-warning-detail.type"

@ObjectType()
/** A finding attributed to a channel draft. */
export class ContentAiWarningType {
    /** The channel the owner should review. */
    @Field()
    channel!: string

    /** The finding. */
    @Field(() => ContentAiWarningDetailType)
    warning!: ContentAiWarningDetailType
}
