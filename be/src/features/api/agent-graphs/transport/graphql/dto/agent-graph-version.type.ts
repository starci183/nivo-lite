import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One frozen version of the graph of an agent. */
export class AgentGraphVersionType {
    /** The version. */
    @Field(() => String)
    id!: string

    /** The number of the version within the agent. */
    @Field(() => Int)
    version!: number

    /** How the version came to be: seed, chat, edit, conflict, learned, template or rollback. */
    @Field(() => String)
    changeKind!: string

    /** What the change was for. */
    @Field(() => String)
    note!: string

    /** When it was published, ISO 8601. */
    @Field(() => String)
    publishedAt!: string

    /** The member who published it, or null. */
    @Field(() => String, { nullable: true })
    publishedBy!: string | null
}
