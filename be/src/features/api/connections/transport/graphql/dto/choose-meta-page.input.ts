import { Field, ID, InputType } from "@nestjs/graphql"
import { IsString, IsUUID, MaxLength, MinLength } from "class-validator"

@InputType()
/** The bounded arguments of chooseMetaPage. */
export class ChooseMetaPageInput {
    /** The connection. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(64)
    connectionId!: string

    /** The Page. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    pageId!: string
}
