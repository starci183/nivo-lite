import { IsString, MaxLength } from "class-validator"

/** The bounded HTTP body of the ChooseMetaPage operation. */
export class ChooseMetaPageBody {
    /** The pageId sent by the caller. */
    @IsString()
    @MaxLength(64)
    pageId!: string
}
