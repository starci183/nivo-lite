import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The members of the workspace settings to change; one left out stays as it is. */
export class UpdateWorkspaceSettingsInput {
    /** The new workspace name. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(120)
    name?: string

    /** The new IANA time zone, for example Asia/Ho_Chi_Minh. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    timeZone?: string

    /** The object path the logo upload address named; null removes the logo, absent keeps it. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    logoPath?: string | null
}
