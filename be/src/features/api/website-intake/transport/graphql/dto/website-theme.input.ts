import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The site key of the hosted page whose theme the page reads. */
export class WebsiteThemeInput {
    /** The public key in the address of the hosted page. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9]{12,40}$/)
    @MaxLength(40)
    siteKey!: string
}
