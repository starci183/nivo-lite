import { Field, ObjectType } from "@nestjs/graphql"
import { LeadAgentType } from "./lead-agent.type"
import { LeadEventType } from "./lead-event.type"
import { LeadExecutionType } from "./lead-execution.type"
import { LeadRecordType } from "./lead-record.type"
import { LeadJourneyResponsibilityType } from "./lead-journey-responsibility.type"

@ObjectType()
/** The customer's lead, responsibilities, approvals and evidence history. */
export class LeadJourneyType {
    /** The customer lead. */
    @Field(() => LeadRecordType)
    lead!: LeadRecordType

    /** The responsibilities opened for the customer. */
    @Field(() => [LeadJourneyResponsibilityType])
    responsibilities!: Array<LeadJourneyResponsibilityType>

    /** The approval cards attached to the customer's responsibilities. */
    @Field(() => [LeadExecutionType])
    executions!: Array<LeadExecutionType>

    /** The customer's evidence history. */
    @Field(() => [LeadEventType])
    events!: Array<LeadEventType>

    /** The workspace's agents available to own a responsibility. */
    @Field(() => [LeadAgentType])
    agents!: Array<LeadAgentType>
}
