import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What accepting or declining an offer answers. */
export class RespondOfferType {
    /** What came of it. */
    @Field(() => String)
    outcome!: string
}
