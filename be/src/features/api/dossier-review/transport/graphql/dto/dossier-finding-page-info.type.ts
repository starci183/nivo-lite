import { Field, ObjectType } from "@nestjs/graphql"
import type { PageInfo } from "@modules/platform/pagination"

@ObjectType()
/** The dossier review transport's representation of the shared continuation contract. */
export class DossierFindingPageInfoType implements PageInfo {
    /** The opaque position of the last returned finding, or null for an empty page. */
    @Field(() => String, { nullable: true })
    endCursor!: string | null

    /** Whether another finding follows this page. */
    @Field(() => Boolean)
    hasNextPage!: boolean
}
