import { Field, ObjectType, ID } from "@nestjs/graphql"
import { ContentActorType } from "./content-actor.type"
import { ContentItemType } from "./content-item.type"
import { ContentLastPlanType } from "./content-last-plan.type"
import { ContentFiguresType } from "./content-figures.type"

@ObjectType()
/** The core content workbench data of a workspace. */
export class ContentWorkbenchType {
    /** The server time used to display the calendar, ISO 8601. */
    @Field()
    nowIso!: string

    /** The selected workspace. */
    @Field(() => ID)
    workspaceId!: string

    /** Whether the caller may manage content. */
    @Field()
    canManage!: boolean

    /** The caller's audit name and content permissions. */
    @Field(() => ContentActorType)
    actor!: ContentActorType

    /** The posts in schedule order. */
    @Field(() => [ContentItemType])
    items!: Array<ContentItemType>

    /** The latest completed editorial plan. */
    @Field(() => ContentLastPlanType, { nullable: true })
    lastPlan!: ContentLastPlanType | null

    /** The content dashboard counts. */
    @Field(() => ContentFiguresType)
    figures!: ContentFiguresType
}
