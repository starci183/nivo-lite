import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What deleting a candidate answers. */
export class DeleteCandidateType {
    /** CV files deleted. */
    @Field(() => Int)
    files!: number
}
