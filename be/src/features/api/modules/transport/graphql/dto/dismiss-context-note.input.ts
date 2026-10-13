import { Field, ID, InputType } from "@nestjs/graphql"
import { IsUUID, MaxLength } from "class-validator"

@InputType()
/** Names the note to dismiss. */
export class DismissContextNoteInput {
    /** The note. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    noteId!: string
}
