import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How the owner's answer to a frozen customer ended. */
export class DecideLeadFreezeType {
    /** `released`, `retrying`, `still_frozen`, `skipped`, `taken_over`, `not_retryable` or `not_frozen`. */
    @Field(() => String)
    outcome!: string
}
