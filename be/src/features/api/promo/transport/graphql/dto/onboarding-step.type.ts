import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A factual onboarding step; its key selects frontend translations. */
export class PromoOnboardingStepType {
    /** The existing promo translation key suffix. */
    @Field()
    key!: string

    /** Whether real workspace data completes the step. */
    @Field()
    done!: boolean

    /** The destination for performing the step. */
    @Field()
    href!: string
}
