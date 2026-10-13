import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The folders a mailbox login can read. */
export class ImapFoldersType {
    /** Folder paths, INBOX first. */
    @Field(() => [String])
    folders!: Array<string>
}
