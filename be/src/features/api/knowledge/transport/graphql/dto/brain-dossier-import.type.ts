import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What importing a dossier checklist did. */
export class BrainDossierImportType {
    /** How many dossiers the workspace tracks after the import. */
    @Field(() => Int)
    imported!: number

    /** How many filled rows were left out because they are not a numbered dossier of a known category and status. */
    @Field(() => Int)
    skipped!: number

    /** How many dossiers the workspace had that the checklist no longer names. */
    @Field(() => Int)
    removed!: number
}
