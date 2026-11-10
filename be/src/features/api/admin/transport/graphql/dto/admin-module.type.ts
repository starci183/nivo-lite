import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent installation of the workspace. */
export class AdminModuleType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The key. */
    @Field()
    key!: string

    /** The status. */
    @Field()
    status!: string

    /** The operating mode. */
    @Field()
    operatingMode!: string

    /** The live. */
    @Field()
    live!: boolean

    /** The context version. */
    @Field(() => Int, { nullable: true })
    contextVersion!: number | null

    /** The context applied at. */
    @Field(() => String, { nullable: true })
    contextAppliedAt!: string | null
}
