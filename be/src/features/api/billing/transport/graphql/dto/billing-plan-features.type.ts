import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Localized feature lines of a plan. */
export class BillingPlanFeaturesType {
    /** Vietnamese features. */
    @Field(() => [String])
    vi!: ReadonlyArray<string>

    /** English features. */
    @Field(() => [String])
    en!: ReadonlyArray<string>
}
