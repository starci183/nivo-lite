import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of authorizeGoogle. */
export class AuthorizeGoogleInput {
    /** The same-site path to come back to. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    @Matches(/^\/(?!\/)/u)
    returnTo!: string

    /** `sheets` to add the spreadsheets access of the ledger; absent for the Sheets connection. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(10)
    @IsIn(["sheets"])
    purpose?: "sheets"
}
