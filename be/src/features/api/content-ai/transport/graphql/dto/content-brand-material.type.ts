import { Field, ObjectType } from "@nestjs/graphql"
import { ContentBrandAuthorityType } from "./content-brand-authority.type"
import { ContentBrandFactType } from "./content-brand-fact.type"
import { ContentBrandSetupType } from "./content-brand-setup.type"
import { ContentBrandSourceType } from "./content-brand-source.type"

@ObjectType()
/** Verified public context available to content planning and drafting. */
export class ContentBrandMaterialType {
    /** The workspace shop name. */
    @Field()
    shop!: string

    /** Brand tone and limits from authority settings. */
    @Field(() => ContentBrandAuthorityType)
    authority!: ContentBrandAuthorityType

    /** The active content setup context. */
    @Field(() => ContentBrandSetupType)
    setup!: ContentBrandSetupType

    /** Public knowledge sources available to marketing. */
    @Field(() => [ContentBrandSourceType])
    sources!: Array<ContentBrandSourceType>

    /** Approved public brain facts. */
    @Field(() => [ContentBrandFactType])
    brainFacts!: Array<ContentBrandFactType>
}
