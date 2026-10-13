import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a template needs before it can be switched on. */
export class TemplateRequirementsType {
    /** The modules that must be installed. */
    @Field(() => [String])
    modules!: ReadonlyArray<string>

    /** The channels the business must talk on. */
    @Field(() => [String])
    channels!: ReadonlyArray<string>

    /** The connections that must exist. */
    @Field(() => [String])
    connections!: ReadonlyArray<string>

    /** The capabilities the shop must have. */
    @Field(() => [String])
    capabilities!: ReadonlyArray<string>
}
