import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A website lead behind the onboarding checklist. */
export class DashboardWebsiteLeadType {
    /** The lead id. */
    @Field(() => ID)
    id!: string

    /** When it came in, ISO 8601. */
    @Field()
    createdAt!: string
}
