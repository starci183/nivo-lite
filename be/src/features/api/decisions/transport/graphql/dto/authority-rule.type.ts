import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The rule of the owner for one action. */
export class AuthorityRuleType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The workspace. */
    @Field(() => ID)
    workspace_id!: string

    /** The module. */
    @Field()
    department!: string

    /** The action key. */
    @Field()
    action!: string

    /** `auto`, `ask` or `never`. */
    @Field()
    mode!: string

    /** The action runs alone strictly below this amount, VND; null means no limit. */
    @Field(() => Float, { nullable: true })
    limit_vnd?: number | null

    /** Fields that must be present. */
    @Field(() => [String])
    required_fields!: ReadonlyArray<string>

    /** A note on the rule. */
    @Field()
    note!: string

    /** When it was saved last, ISO 8601. */
    @Field()
    updated_at!: string
}
