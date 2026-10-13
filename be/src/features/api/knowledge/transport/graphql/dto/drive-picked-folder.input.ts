import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The picked folder and the short-lived token that lists it. */
export class DrivePickedFolderInput {
    /** The Drive id of the folder. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    folderId!: string

    /** The short-lived token of the browser; used for this call only. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(4096)
    token!: string
}
