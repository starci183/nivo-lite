import { Field, ObjectType } from "@nestjs/graphql"
import { DriveFolderType } from "./drive-folder.type"

@ObjectType()
/** The files of a folder picked in the Google Picker. */
export class PickedFolderType extends DriveFolderType {
    /** True when the listing came back empty or refused: the owner picks the files inside. */
    @Field(() => Boolean)
    empty!: boolean
}
