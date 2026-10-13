import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The active content setup context. */
export class ContentBrandSetupType {
    /** Business summary confirmed during setup. */
    @Field()
    summary!: string

    /** Confirmed facts from the active setup. */
    @Field(() => [String])
    facts!: Array<string>

    /** The accepted tone gate. */
    @Field()
    tone!: string

    /** Limits on marketing claims. */
    @Field()
    claimsLimits!: string

    /** The intended audience. */
    @Field()
    audience!: string

    /** The chosen channel gate. */
    @Field()
    channels!: string
}
