import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** LeadGenComment exposed to the workbench. */
export class LeadGenCommentType {
    /** The public reply awaiting approval. */
    @Field(() => ID)
    workItemId!: string

    /** Source network. */
    @Field(() => String)
    platform!: string

    /** The commenter name. */
    @Field(() => String)
    author!: string

    /** Original public comment. */
    @Field(() => String)
    comment!: string

    /** Proposed public reply. */
    @Field(() => String)
    draft!: string

    /** Readable post or source reference. */
    @Field(() => String, { nullable: true })
    refLabel!: string | null

    /** When the proposal was created. */
    @Field(() => String)
    at!: string
}
