import { Field, InputType } from "@nestjs/graphql"
import { Matches, MaxLength } from "class-validator"

@InputType()
/** Which week to report. */
export class MarketingReportInput {
    /** Monday of the week, `YYYY-MM-DD`; empty for the last complete week. */
    @Field({ defaultValue: "" })
    @MaxLength(10)
    @Matches(/^(\d{4}-\d{2}-\d{2})?$/u)
    weekStart!: string
}
