import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The value agents read now for a contradiction. */
export class DossierFindingInUseType {
    /** The value of the one active fact. */
    @Field(() => String)
    value!: string

    /** The title of the document that fact came from, or null. */
    @Field(() => String, { nullable: true })
    sourceTitle?: string | null
}
