import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The pasted folder link. */
export class DriveLinkedFolderInput {
    /** The address of the Drive folder. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(2048)
    url!: string
}
