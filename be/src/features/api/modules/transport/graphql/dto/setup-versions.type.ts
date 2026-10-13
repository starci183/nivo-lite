import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ContextVersionType } from "./context-version.type"

@ObjectType()
/** The context versions of an installation with the one in use. */
export class SetupVersionsType {
    /** The versions, newest first. */
    @Field(() => [ContextVersionType])
    versions!: ReadonlyArray<ContextVersionType>

    /** The version in use; null before the first apply. */
    @Field(() => ID, { nullable: true })
    activeVersionId?: string | null
}
