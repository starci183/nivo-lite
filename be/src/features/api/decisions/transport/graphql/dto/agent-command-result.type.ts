import { Field, ID, Int, ObjectType } from "@nestjs/graphql"
import { WorkItemType } from "./work-item.type"

@ObjectType()
/** What the command bus answered: the work item the command became, or the reason it was refused. */
export class AgentCommandResultType {
    /** True when the command became a work item. */
    @Field()
    ok!: boolean

    /** The work item, when the command was accepted. */
    @Field(() => WorkItemType, { nullable: true })
    item?: WorkItemType | null

    /** False when the same command about the same subject already existed. */
    @Field(() => Boolean, { nullable: true })
    created?: boolean | null

    /** The chain the item joined. */
    @Field(() => ID, { nullable: true })
    chainId?: string | null

    /** Its depth in the chain. */
    @Field(() => Int, { nullable: true })
    depth?: number | null

    /** Why the command was refused. */
    @Field(() => String, { nullable: true })
    refused?: string | null

    /** The refusal in a sentence. */
    @Field(() => String, { nullable: true })
    detail?: string | null

    /** The payload keys still missing. */
    @Field(() => [String], { nullable: true })
    missing?: ReadonlyArray<string> | null
}
