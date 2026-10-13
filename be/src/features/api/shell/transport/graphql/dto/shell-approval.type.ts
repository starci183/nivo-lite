import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One draft waiting for approval. */
export class ShellApprovalType {
    /** The execution id. */
    @Field(() => ID)
    id!: string

    /** The drafted text. */
    @Field()
    draft!: string

    /** What happens next, when known. */
    @Field(() => String, { nullable: true })
    nextAction!: string | null

    /** The customer the draft belongs to. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer name. */
    @Field(() => String, { nullable: true })
    contactName!: string | null
}
