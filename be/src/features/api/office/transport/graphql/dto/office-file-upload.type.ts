import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the browser uploads a file of an Office line. */
export class OfficeFileUploadType {
    /** The object path to name when the line is posted. */
    @Field()
    path!: string

    /** The presigned address. */
    @Field()
    signedUrl!: string
}
