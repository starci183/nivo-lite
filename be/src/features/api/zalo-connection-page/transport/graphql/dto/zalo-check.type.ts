import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One row of the check list of a Zalo OA connection. */
export class ZaloCheckType {
    /** app, token, webhook or permissions. */
    @Field(() => String)
    key!: string

    /** ok, fail or warn. */
    @Field(() => String)
    state!: string

    /** The code the page words the detail line with. */
    @Field(() => String)
    code!: string

    /** The time the detail refers to, ISO 8601. */
    @Field(() => String, { nullable: true })
    at!: string | null

    /** Names the detail lists. */
    @Field(() => [String])
    names!: ReadonlyArray<string>
}
