import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One file found in a Google Drive folder. */
export class DriveFileType {
    /** The Drive id. */
    @Field(() => ID)
    id!: string

    /** The name in Drive. */
    @Field(() => String)
    name!: string

    /** The Drive type. */
    @Field(() => String)
    mimeType!: string

    /** The size in bytes, when Drive reports it. */
    @Field(() => Float, { nullable: true })
    size?: number | null

    /** The last change, when Drive reports it. */
    @Field(() => String, { nullable: true })
    modifiedTime?: string | null

    /** The folders between the pasted folder and the file, joined by `/`; empty at the top. */
    @Field(() => String)
    path!: string
}
