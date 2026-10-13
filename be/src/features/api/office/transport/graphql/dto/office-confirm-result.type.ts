import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What confirming a command card did. */
export class OfficeConfirmResultType {
    /** The work item the command became. */
    @Field(() => ID)
    workItemId!: string

    /** The receiving module. */
    @Field()
    module!: string

    /** False when the same work already existed. */
    @Field()
    created!: boolean
}
