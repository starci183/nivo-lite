import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The first workspace of the caller: its id, or null when none was created (signup is off, or they already belong somewhere). */
export class StartFirstWorkspaceType {
    /** The id of the new workspace, or null. */
    @Field(() => ID, { nullable: true })
    id!: string | null
}
