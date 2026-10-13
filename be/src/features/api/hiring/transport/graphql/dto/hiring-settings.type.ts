import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The hiring settings of the workspace. */
export class HiringSettingsType {
    /** The workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** The slug of the workspace's public job pages. */
    @Field(() => String)
    publicSlug!: string

    /** Days a rejected or withdrawn candidate is kept. */
    @Field(() => Int)
    retentionDays!: number

    /** Whether a new candidate is announced in the Office. */
    @Field(() => Boolean)
    notifyNewCandidate!: boolean

    /** Whether confirmed interviews are reminded. */
    @Field(() => Boolean)
    remindInterview!: boolean

    /** Whether a job closes once enough people accepted. */
    @Field(() => Boolean)
    autoCloseWhenFilled!: boolean

    /** The consent text an applicant agrees to. */
    @Field(() => String)
    applyConsentText!: string

    /** The tone of generated ads. */
    @Field(() => String)
    adTone!: string
}
