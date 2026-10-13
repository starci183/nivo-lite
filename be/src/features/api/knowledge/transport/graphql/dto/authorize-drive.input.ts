import { Field, InputType } from "@nestjs/graphql"
import { IsString, Matches, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments of authorizeDrive. */
export class AuthorizeDriveInput {
    /** The same-site path to come back to. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    @Matches(/^\/(?!\/)/u)
    returnTo!: string
}
