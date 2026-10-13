import { IsIn, IsOptional, IsString, MaxLength } from "class-validator"

/** The bounded HTTP request that decides a fact. */
export class DecideFactRequest {
    /** apply or reject a proposal, choose it among competing values, split it into its own fact, or retire an active fact. */
    @IsIn(["apply", "reject", "choose", "split", "retire"])
    action!: "apply" | "reject" | "choose" | "split" | "retire"

    /** The reason given with the decision. */
    @IsOptional()
    @IsString()
    @MaxLength(500)
    note?: string

    /** The situation a split value is for. */
    @IsOptional()
    @IsString()
    @MaxLength(120)
    situation?: string
}
