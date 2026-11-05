import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Who owns a dossier and by when, as a change left them. */
export class BrainDossierOwnerType {
    /** The dossier id. */
    @Field(() => ID)
    id!: string

    /** The member who owns it (a membership id), or null. */
    @Field(() => ID, { nullable: true })
    assigneeId!: string | null

    /** The date it should be settled by as YYYY-MM-DD, or null. */
    @Field(() => String, { nullable: true })
    dueAt!: string | null
}
