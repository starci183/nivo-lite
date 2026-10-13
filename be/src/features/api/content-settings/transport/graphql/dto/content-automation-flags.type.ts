import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** ContentAutomationFlags returned by content settings operations. */
export class ContentAutomationFlagsType {
    /** todayReminder. */
    @Field()
    todayReminder!: boolean

    /** offerDraft. */
    @Field()
    offerDraft!: boolean

    /** weeklySummary. */
    @Field()
    weeklySummary!: boolean
}
