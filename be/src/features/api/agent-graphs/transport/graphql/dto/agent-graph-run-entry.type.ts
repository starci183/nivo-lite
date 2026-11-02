import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One run of the graph of an agent as the owner lists it. The facts and the path travel as JSON text. */
export class AgentGraphRunEntryType {
    /** The run. */
    @Field(() => String)
    id!: string

    /** The road it left by: work, reply, tool or handover. */
    @Field(() => String)
    road!: string

    /** The mode the graph ran in: enforced or shadow. */
    @Field(() => String)
    mode!: string

    /** The action key. */
    @Field(() => String)
    action!: string

    /** The number of the version it ran on, or null when it is past the listing. */
    @Field(() => Int, { nullable: true })
    version!: number | null

    /** The branch that matched, or the node the walk entered at; empty when no node holds the action. */
    @Field(() => String)
    branchKey!: string

    /** What the graph did: auto, ask, stop or divert. */
    @Field(() => String)
    outcome!: string

    /** What the gate answered, or null on a road no gate judges. */
    @Field(() => String, { nullable: true })
    gateVerdict!: string | null

    /** How the work ended, or null while it is open. */
    @Field(() => String, { nullable: true })
    closedAs!: string | null

    /** True when the graph answered differently from the gate alone. */
    @Field(() => Boolean)
    differs!: boolean

    /** Why the graph could not judge it, or null. */
    @Field(() => String, { nullable: true })
    unjudged!: string | null

    /** The facts it could not read, as JSON text. */
    @Field(() => String)
    unreadJson!: string

    /** The facts as read, as JSON text. */
    @Field(() => String)
    factsJson!: string

    /** The nodes the walk went through, as JSON text. */
    @Field(() => String)
    pathJson!: string

    /** The work item, or null on a run that left none. */
    @Field(() => String, { nullable: true })
    workItemId!: string | null

    /** The type of the subject, or null. */
    @Field(() => String, { nullable: true })
    subjectType!: string | null

    /** The id of the subject, or null. */
    @Field(() => String, { nullable: true })
    subjectId!: string | null

    /** When it ran. */
    @Field(() => String)
    createdAt!: string
}
