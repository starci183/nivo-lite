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

/** The bounded HTTP request that saves the rule of one action. */
export class SaveRuleRequest {
    /** The action key; its module is the one the registry gives. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(80)
    action!: string

    /** Run alone, ask a person, or never. */
    @IsIn(["auto", "ask", "never"])
    mode!: "auto" | "ask" | "never"

    /** The action runs alone strictly below this amount, VND; null means no limit. */
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(1000000000000)
    limit_vnd: number | null = null

    /** Fields that must be present; none when absent. */
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    @Matches(/^[a-z0-9_]+$/, { each: true })
    @MaxLength(60, { each: true })
    required_fields: Array<string> = []
}
