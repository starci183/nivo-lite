import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An approval card after a decision. */
export class ApprovalExecutionType {
    /** The card id. */
    @Field(() => ID)
    id!: string

    /** `pending_approval`, `approved` or `rejected`. */
    @Field()
    status!: string

    /** The work item behind it. */
    @Field(() => ID, { nullable: true })
    work_item_id?: string | null

    /** The draft as decided. */
    @Field()
    draft!: string
}
