import { Field, ID, ObjectType } from "@nestjs/graphql"
import { MetaPageOptionType } from "./meta-page-option.type"
import { FirstEventType } from "./first-event.type"

@ObjectType()
/** The wizard view of a Meta connection. */
export class MetaWizardConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** Meta app keys are set on this NIVO. */
    @Field(() => Boolean)
    configured!: boolean

    /** The Pages waiting for the choice. */
    @Field(() => [MetaPageOptionType])
    pages!: ReadonlyArray<MetaPageOptionType>

    /** The chosen Page. */
    @Field(() => String)
    pageId!: string

    /** The chosen Page name. */
    @Field(() => String)
    pageName!: string

    /** The linked Instagram account id. */
    @Field(() => String)
    igId!: string

    /** The linked Instagram username. */
    @Field(() => String)
    igUsername!: string

    /** The first event it accepted. */
    @Field(() => FirstEventType, { nullable: true })
    firstEvent!: FirstEventType | null

    /** The agents that use it. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>
}
