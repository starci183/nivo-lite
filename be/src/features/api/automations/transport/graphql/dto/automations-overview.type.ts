import { Field, ObjectType } from "@nestjs/graphql"
import { AutomationCardType } from "./automation-card.type"
import { AutomationRunType } from "./automation-run.type"
import { PreviewSampleType } from "./preview-sample.type"
import { ShopContextType } from "./shop-context.type"

@ObjectType()
/** Everything the automations screen shows. */
export class AutomationsOverviewType {
    /** One card per template. */
    @Field(() => [AutomationCardType])
    cards!: ReadonlyArray<AutomationCardType>

    /** The latest runs. */
    @Field(() => [AutomationRunType])
    runs!: ReadonlyArray<AutomationRunType>

    /** The shop the previews speak for. */
    @Field(() => ShopContextType)
    shop!: ShopContextType

    /** The sample data of the previews. */
    @Field(() => PreviewSampleType)
    sample!: PreviewSampleType
}
