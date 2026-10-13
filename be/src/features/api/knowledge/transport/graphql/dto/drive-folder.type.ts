import { Field, ObjectType } from "@nestjs/graphql"
import { DriveFileType } from "./drive-file.type"

@ObjectType()
/** The files of a Google Drive folder. */
export class DriveFolderType {
    /** The name of the folder. */
    @Field(() => String)
    name!: string

    /** The files below it, folders themselves left out. */
    @Field(() => [DriveFileType])
    files!: Array<DriveFileType>

    /** True when the listing stopped at the file or depth limit. */
    @Field(() => Boolean)
    truncated!: boolean
}
