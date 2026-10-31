import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One dossier the workspace tracks in its Second Brain. */
export class BrainDossierType {
    /** The dossier id. */
    @Field(() => ID)
    id!: string

    /** The reference documents name it by: the checklist number. */
    @Field(() => String)
    ref!: string

    /** The category: the same label as the topic of its documents. */
    @Field(() => String)
    category!: string

    /** The number the category carries in its folder name. */
    @Field(() => Int)
    categoryOrder!: number

    /** Where the dossier sits among all of the workspace. */
    @Field(() => Int)
    position!: number

    /** The name of the dossier. */
    @Field(() => String)
    name!: string

    /** One of present, partial, drafted, missing or template. */
    @Field(() => String)
    status!: string

    /** The documents already held, as the checklist words them, or null. */
    @Field(() => String, { nullable: true })
    existing?: string | null

    /** What is still missing or to be done, or null. */
    @Field(() => String, { nullable: true })
    missing?: string | null

    /** The drafts and registers already written, or null. */
    @Field(() => String, { nullable: true })
    drafts?: string | null

    /** How many documents of its category name its reference. */
    @Field(() => Int)
    documentCount!: number
}
