import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** The uploaded picture to keep, or none to remove it. */
export class SetMyAvatarInput {
    /** The object path the upload address named; null removes the uploaded picture. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    path?: string | null
}
