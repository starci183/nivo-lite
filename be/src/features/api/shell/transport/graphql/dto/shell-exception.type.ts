import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One exception with no approval card of its own. */
export class ShellExceptionType {
    /** The work item id. */
    @Field(() => ID)
    id!: string

    /** The customer the item belongs to. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer name. */
    @Field(() => String, { nullable: true })
    contactName!: string | null

    /** The proposal summary. */
    @Field(() => String, { nullable: true })
    summary!: string | null

    /** The failure, when the item failed. */
    @Field(() => String, { nullable: true })
    error!: string | null
}
