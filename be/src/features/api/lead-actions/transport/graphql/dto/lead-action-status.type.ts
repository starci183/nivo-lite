import { Field, ObjectType } from "@nestjs/graphql"
import { LeadActionResultType } from "./lead-action-result.type"

@ObjectType()
/** Persisted progress and result of an asynchronous lead action. */
export class LeadActionStatusType {
    /** The queued lead action identifier. */
    @Field()
    id!: string

    /** queued, running, succeeded or failed. */
    @Field()
    status!: string

    /** References and context produced when the action succeeds. */
    @Field(() => LeadActionResultType, { nullable: true })
    result!: LeadActionResultType | null

    /** The domain fault code when the action fails. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
