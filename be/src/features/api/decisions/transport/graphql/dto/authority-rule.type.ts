import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

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

    /** The action runs alone strictly below this amount, VND; null means no limit. Rules with bands ignore it. */
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

    /** What the amount is counted in: `vnd`, `percent` or `count`. */
    @Field()
    unit!: string

    /** The action runs alone up to this amount (inclusive); null means no auto band. */
    @Field(() => Float, { nullable: true })
    auto_max!: number | null

    /** A person is asked up to this amount (inclusive), above it the action never runs; null means no upper bound. */
    @Field(() => Float, { nullable: true })
    ask_max!: number | null

    /** The agents the rule applies to; empty means every agent. */
    @Field(() => [ID])
    agents!: ReadonlyArray<string>

    /** Roles whose members may approve. */
    @Field(() => [String])
    approver_roles!: ReadonlyArray<string>

    /** Department rooms whose people may approve. */
    @Field(() => [String])
    approver_rooms!: ReadonlyArray<string>

    /** Members named as approvers, in the order they are asked. */
    @Field(() => [ID])
    approver_members!: ReadonlyArray<string>

    /** `any`, `all` or `sequential`. */
    @Field()
    approval_policy!: string

    /** Minutes a request waits before it goes to the owner of the agent. */
    @Field(() => Int)
    timeout_minutes!: number
}
