import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One agent installation as the list shows it. */
export class AdminModuleBadgeType {
    /** The key. */
    @Field()
    key!: string

    /** The status. */
    @Field()
    status!: string

    /** The live. */
    @Field()
    live!: boolean
}
