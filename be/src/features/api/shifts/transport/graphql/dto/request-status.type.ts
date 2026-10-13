import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What asking for a decision ended in. */
export class RequestStatusType {
    /** The status of the decision: done when it ran at once, waiting_decision when a person must decide. */
    @Field(() => String)
    status!: string
}
