import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A one-time address to upload an agent picture to. */
export class AgentAvatarUploadType {
    /** The object path; hand it back to setAgentAvatar once the upload finished. */
    @Field()
    path!: string

    /** The one-time token of the upload. */
    @Field()
    token!: string

    /** The signed address to PUT the picture to. */
    @Field()
    signedUrl!: string

    /** The public address the picture is read at once it is set. */
    @Field()
    publicUrl!: string
}
