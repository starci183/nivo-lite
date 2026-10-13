import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The Accounting work item associated with a Sales handoff. */
export class SalesHandoffWorkType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** The reason. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The error. */
    @Field(() => String, { nullable: true })
    error!: string | null
}
