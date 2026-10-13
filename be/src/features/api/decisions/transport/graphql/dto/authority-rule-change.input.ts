import { Field, InputType, Int } from "@nestjs/graphql"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
} from "class-validator"

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
}
