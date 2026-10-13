import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The first response event of a website lead. */
export class DashboardFirstEventType {
    /** The lead id. */
    @Field(() => ID)
    leadId!: string

    /** When the first response happened, ISO 8601. */
    @Field()
    at!: string
}
