import { Field, Float, ID, InputType, Int } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator"
import { APPROVAL_POLICIES, RULE_UNITS } from "@modules/domain/authority-rules"
import type { ApprovalPolicy, RuleUnit } from "@modules/domain/authority-rules"
import type { WorkspaceRole } from "@modules/domain/workspace-members"

@InputType()
/** The rule of one action. */
export class AuthorityRuleChangeInput {
    /** The action key. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(80)
    action!: string

    /** The module the action belongs to. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(40)
    department!: string

    /** Run alone, ask a person, or never. */
    @Field()
    @IsIn(["auto", "ask", "never"])
    mode!: "auto" | "ask" | "never"

    /** The action runs alone strictly below this amount, VND; null means no limit. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    limit_vnd: number | null = null

    /** Fields that must be present; none when absent. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @Matches(/^[a-z0-9_]+$/, { each: true })
    @MaxLength(60, { each: true })
    required_fields: Array<string> = []

    /** A note on the rule; absent leaves the stored note. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note: string | null = null

    /** What the amount is counted in: `vnd`, `percent` or `count`; absent leaves the stored unit. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(RULE_UNITS)
    unit?: RuleUnit

    /** The action runs alone up to this amount (inclusive); null clears the band; absent leaves both bands as stored. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1000000000000)
    auto_max?: number | null

    /** A person is asked up to this amount (inclusive), above it the action never runs; null clears the bound. Sent together with `auto_max`. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1000000000000)
    ask_max?: number | null

    /** Roles whose members may approve; absent leaves the stored group. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(3)
    @IsIn(["owner", "manager", "staff"], { each: true })
    approver_roles?: Array<WorkspaceRole>

    /** Department rooms whose people may approve. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(20)
    @IsString({ each: true })
    @Matches(/^[a-z][a-z0-9_-]{0,39}$/, { each: true })
    approver_rooms?: Array<string>

    /** Members named as approvers, in the order they are asked. */
    @Field(() => [ID], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID(undefined, { each: true })
    approver_members?: Array<string>

    /** `any`, `all` or `sequential`. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(APPROVAL_POLICIES)
    approval_policy?: ApprovalPolicy

    /** Minutes a request waits before it goes to the owner of the agent, 1 to 10080. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10080)
    timeout_minutes?: number

    /** The agents the rule applies to; empty means every agent. */
    @Field(() => [ID], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(50)
    @IsUUID(undefined, { each: true })
    agents?: Array<string>
}
