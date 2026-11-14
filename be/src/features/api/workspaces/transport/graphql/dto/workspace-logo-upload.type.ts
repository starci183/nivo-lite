import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A one-time address to upload the workspace logo to. */
export class WorkspaceLogoUploadType {
    /** The object path; hand it back to updateWorkspaceSettings once the upload finished. */
    @Field()
    path!: string

    /** The one-time token of the upload. */
    @Field()
    token!: string

    /** The signed address to PUT the picture to. */
    @Field()
    signedUrl!: string

    /** The public address the logo is read at once it is saved. */
    @Field()
    publicUrl!: string
}
