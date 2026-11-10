import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One immutable version of a workflow: a full graph snapshot. */
export class AgentWorkflowVersionType {
    /** The version. */
    @Field(() => String)
    id!: string

    /** The number within the workflow. */
    @Field(() => Int)
    number!: number

    /** template, blank, adopt, copy, edit, proposal, accept_template or rollback. */
    @Field(() => String)
    changeKind!: string

    /** owner, nivo or system. */
    @Field(() => String)
    authorKind!: string

    /** The member who made it, or null. */
    @Field(() => String, { nullable: true })
    authorId!: string | null

    /** The reason or summary. */
    @Field(() => String)
    note!: string

    /** The template provenance, or null. */
    @Field(() => String, { nullable: true })
    templateId!: string | null

    /** The template version of the provenance, or null. */
    @Field(() => Int, { nullable: true })
    templateVersion!: number | null

    /** The version a rollback copied, or null. */
    @Field(() => Int, { nullable: true })
    fromNumber!: number | null

    /** When it was published, ISO 8601. */
    @Field(() => String)
    publishedAt!: string

    /** How many steps it has. */
    @Field(() => Int)
    stepCount!: number

    /** How many steps differ from the version before; null for the first. */
    @Field(() => Int, { nullable: true })
    changedSteps!: number | null

    /** Whether it is the version that runs. */
    @Field(() => Boolean)
    active!: boolean
}
