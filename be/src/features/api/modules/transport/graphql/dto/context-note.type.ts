import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A note waiting to be applied into an installation's context. */
export class ContextNoteType {
    /** The note. */
    @Field(() => ID)
    id!: string

    /** The installation it supplements. */
    @Field(() => ID)
    installationId!: string

    /** The note text. */
    @Field()
    body!: string

    /** `office` or `setup`. */
    @Field()
    source!: string

    /** Who wrote it. */
    @Field()
    authorName!: string

    /** `owner`, `manager` or `staff`. */
    @Field()
    authorRole!: string

    /** `pending`, `applied` or `dismissed`. */
    @Field()
    status!: string

    /** When it was written, ISO 8601. */
    @Field()
    createdAt!: string
}
