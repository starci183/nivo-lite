import { Field, ObjectType } from "@nestjs/graphql"
import { LeadRecordType } from "./lead-record.type"

@ObjectType()
/** A board lead with its current responsibility's owner and next action. */
export class LeadBoardType extends LeadRecordType {
    /** The current responsibility's owner, when there is an open responsibility. */
    @Field(() => String, { nullable: true })
    ownerName!: string | null

    /** The next action, when there is an open responsibility. */
    @Field(() => String, { nullable: true })
    nextAction!: string | null
}
