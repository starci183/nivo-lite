import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A stored media file available to the content workbench. */
export class ContentMediaRefType {
    /** The media reference source, `media`. */
    @Field()
    kind!: string

    /** The object's workspace-scoped storage path. */
    @Field()
    path!: string

    /** The file name displayed to the user. */
    @Field()
    name!: string
}
