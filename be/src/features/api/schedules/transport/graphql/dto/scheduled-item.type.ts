import { Field, ID, ObjectType } from "@nestjs/graphql"
import { DoorPressType } from "./door-press.type"

@ObjectType()
/** The record a scheduled item is about. */
export class ScheduledSubjectType {
    /** order, lead, task, trigger or run. */
    @Field(() => String)
    kind!: string

    /** Its id. */
    @Field(() => ID)
    id!: string
}

@ObjectType()
/** The workflow a scheduled item will wake. */
export class ScheduledWorkflowType {
    /** The workflow. */
    @Field(() => ID)
    workflowId!: string

    /** Its key within the agent, or null when only the id is known. */
    @Field(() => String, { nullable: true })
    key!: string | null

    /** Its name (empty when it could not be read). */
    @Field(() => String)
    name!: string
}

@ObjectType()
/** One thing an agent of the workspace has scheduled: what, for whom, due when, and which workflow and step it will wake. */
export class ScheduledItemType {
    /** The item key runScheduledItemNow takes back. */
    @Field(() => ID)
    id!: string

    /** care (a care step's timer), task (another agent task), schedule (the next slot of a clock trigger) or deadline (of a stop). */
    @Field(() => String)
    kind!: string

    /**
     * What exactly: the care step (payment-reminder, payment-stale, delivery-check, occasion), the task title, the probe or preset of the
     * trigger (accounting_close, daily_at), or the kind of the stop (approval, ai_report, ai_error).
     */
    @Field(() => String)
    what!: string

    /** The agent that holds it. */
    @Field(() => ID)
    agentId!: string

    /** The installation of that agent, or null. */
    @Field(() => ID, { nullable: true })
    installationId!: string | null

    /** The name the owner gave the agent's installation, or null. */
    @Field(() => String, { nullable: true })
    agentName!: string | null

    /** The record it is about. */
    @Field(() => ScheduledSubjectType)
    subject!: ScheduledSubjectType

    /** When it fires. */
    @Field(() => Date)
    dueAt!: Date

    /** A care step's own moment (later than dueAt when its timer wakes early and re-arms), else null. */
    @Field(() => Date, { nullable: true })
    realDueAt!: Date | null

    /** The workflow it will wake, or null when none of the agent's active workflows takes it. */
    @Field(() => ScheduledWorkflowType, { nullable: true })
    workflow!: ScheduledWorkflowType | null

    /** The step it will wake: the stopped step of a deadline; null when the workflow starts at its entry. */
    @Field(() => String, { nullable: true })
    stepKey!: string | null

    /** The run of a deadline, else null. */
    @Field(() => ID, { nullable: true })
    runId!: string | null

    /** The last "run now" press on this item, or null. */
    @Field(() => DoorPressType, { nullable: true })
    lastPress!: DoorPressType | null
}
