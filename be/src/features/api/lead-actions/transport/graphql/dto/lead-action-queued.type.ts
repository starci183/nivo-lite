import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A lead action accepted for asynchronous processing. */
export class LeadActionQueuedType {
    /** The queued action's identifier, used to poll its status. */
    @Field()
    id!: string

    /** The initial queued state of the lead action. */
    @Field()
    status!: string
}
