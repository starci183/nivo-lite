import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What the quick import added. */
export class ApplyImportType {
    /** The positions added. */
    @Field(() => Int)
    positions!: number

    /** The people added. */
    @Field(() => Int)
    staff!: number

    /** The coverage blocks added. */
    @Field(() => Int)
    blocks!: number
}
