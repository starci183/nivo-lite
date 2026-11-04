import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of setLedgerSheet. */
export class SetLedgerSheetInput {
    /** The link or the id of the Google spreadsheet the ledger is written to. */
    @Field(() => String)
    @IsString()
    @MinLength(20)
    @MaxLength(300)
    sheet!: string
}
