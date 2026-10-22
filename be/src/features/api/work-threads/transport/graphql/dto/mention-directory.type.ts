import { Field, ObjectType } from "@nestjs/graphql"
import { MentionOptionType } from "./mention-option.type"

@ObjectType()
/** The three sections of the composer's @ list. */
export class MentionDirectoryType {
    /** The people of the workspace. */
    @Field(() => [MentionOptionType])
    members!: ReadonlyArray<MentionOptionType>

    /** The active agents. */
    @Field(() => [MentionOptionType])
    agents!: ReadonlyArray<MentionOptionType>

    /** The groups: roles and rooms. */
    @Field(() => [MentionOptionType])
    groups!: ReadonlyArray<MentionOptionType>
}
