import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What entering manual evidence did. */
export class ManualEvidenceType {
    /** True when the same evidence had already been entered: nothing new was recorded. */
    @Field(() => Boolean)
    duplicate!: boolean
}
