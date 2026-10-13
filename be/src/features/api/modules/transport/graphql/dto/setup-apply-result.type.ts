import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What applying a setup answers. */
export class SetupApplyResultType {
    /** The number of the new version. */
    @Field(() => Int)
    version!: number
}
