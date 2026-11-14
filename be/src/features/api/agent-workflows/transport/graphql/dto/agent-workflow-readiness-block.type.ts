import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One provider that keeps a workflow hidden, and why: `not_connected`, `trigger_off`, `needs_pick` or `tool_unavailable`. */
export class AgentWorkflowReadinessBlockType {
    /** The provider, by key (`zalo_oa`, `sepay`). */
    @Field(() => String)
    provider!: string

    /**
     * Why: the agent has no account of it (`not_connected`), every account it has keeps the trigger off (`trigger_off`), or it has
     * several and none is picked for the step, or two of its accounts read one stream of a trigger and none is picked (`needs_pick`).
     */
    @Field(() => String)
    reason!: string

    /**
     * For a trigger's `needs_pick`: the stream two attached accounts read (`bank-account:VCB:0123456789`, `mailbox:ketoan@shop.vn`), what
     * a pick names (`agreeAgentNodeRights` `triggerPicks`); null for any other block.
     */
    @Field(() => String, { nullable: true })
    stream!: string | null

    /** For a trigger's `needs_pick`: the accounts that read the stream, one of which the owner picks; empty for any other block. */
    @Field(() => [ID])
    connectionIds!: ReadonlyArray<string>

    /**
     * For a block a trigger causes (`not_connected`, `trigger_off`, `needs_pick`): the trigger purpose it is about, by verb
     * (`nivo.trigger.payment.credit.received`); what a pick names (`agreeAgentNodeRights` `triggerPicks[].verb`). Null for any other block.
     */
    @Field(() => String, { nullable: true })
    verb!: string | null

    /** For `tool_unavailable`: the tool no bound account of the provider serves, by id (`nivo.tool.invoice.create`); null for any other block. */
    @Field(() => String, { nullable: true })
    tool!: string | null
}
