import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An address a browser uploads one document to. */
export class UploadAddressType {
    /** The object path to give back when the document is added. */
    @Field(() => String)
    path!: string

    /** The one-time upload token. */
    @Field(() => String)
    token!: string

    /** The signed address to PUT the file to. */
    @Field(() => String)
    signedUrl!: string
}
