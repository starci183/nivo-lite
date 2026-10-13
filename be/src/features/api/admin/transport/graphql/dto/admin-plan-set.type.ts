import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What moving a workspace to a plan answers. */
export class AdminPlanSetType {
    /** The plan code. */
    @Field()
    planCode!: string

    /** The credits limit. */
    @Field(() => Float, { nullable: true })
    creditsLimit!: number | null
}
