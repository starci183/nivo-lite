/** The doors a press is recorded for. */
export type DoorName = "schedule.run_now" | "care.opt_out" | "conversation.release"

/** One press of a door: who, when, on what, and what it came to. */
export interface DoorPress {
    /** The door. */
    readonly door: DoorName
    /** What it was pressed on: the item key, the lead id, the conversation id. */
    readonly subject: string
    /** The workspace member who pressed. */
    readonly memberId: string
    /** Their name as it read when they pressed. */
    readonly memberName: string
    /** What it came to (the door's outcome). */
    readonly outcome: string
    /** When. */
    readonly at: Date
}

/** A press, or none. */
export type OptionalDoorPress = DoorPress | null

/** What a door writes for one press. */
export interface DoorPressWrite {
    /** The workspace. */
    readonly workspaceId: string
    /** The door. */
    readonly door: DoorName
    /** What it was pressed on. */
    readonly subject: string
    /** Who pressed. */
    readonly memberId: string
    /** Their name. */
    readonly memberName: string
    /** What it came to. */
    readonly outcome: string
    /** Plain facts of the press (never customer words), kept beside it. */
    readonly detail?: Readonly<Record<string, string | number | boolean | null>>
}

/** The person behind a door call, as the door proved them: an owner or a manager of the workspace. */
export interface DoorActor {
    /** Their seat (workspace member id). */
    readonly memberId: string
    /** Their name. */
    readonly name: string
}

/** What a scheduled item is: an agent task, the next slot of a clock trigger, or the deadline of a stop. */
export type ScheduledItemKind = "task" | "schedule" | "deadline"

/** The record a scheduled item is about. */
export interface ScheduledSubject {
    /** `order`, `lead`, `task`, `trigger` or `run`. */
    readonly kind: "order" | "lead" | "task" | "trigger" | "run"
    /** Its id. */
    readonly id: string
}

/** The workflow a scheduled item will wake, when one of the agent's active workflows takes it. */
export interface ScheduledWorkflow {
    /** The workflow id. */
    readonly workflowId: string
    /** Its key within the agent, or null when only the id is known. */
    readonly key: string | null
    /** Its name. */
    readonly name: string
}

/** One thing scheduled in the workspace: what, for whom, due when, and which workflow and step it will wake. */
export interface ScheduledItem {
    /** The item key "run now" takes back (it names the item as it stands: a later arming is another key). */
    readonly id: string
    /** What kind of thing it is. */
    readonly kind: ScheduledItemKind
    /** What exactly: the care step (`payment-reminder`, `payment-stale`, `delivery-check`, `occasion`), the task title, the preset of a trigger, the kind of the stop. */
    readonly what: string
    /** The agent that holds it. */
    readonly agentId: string
    /** The installation of that agent, or null (a deadline of an agent with no installation). */
    readonly installationId: string | null
    /** The name the owner gave the agent's installation, or null. */
    readonly agentName: string | null
    /** The record it is about. */
    readonly subject: ScheduledSubject
    /** When it fires. */
    readonly dueAt: Date
    /** The moment an item is really due when that is later than `dueAt` (a timer that wakes early and re-arms); no scheduled item holds one today, so always null. */
    readonly realDueAt: Date | null
    /** The workflow it will wake, or null when none of the agent's active workflows takes it. */
    readonly workflow: ScheduledWorkflow | null
    /** The step it will wake: the stopped step of a deadline; null when the workflow starts at its entry. */
    readonly stepKey: string | null
    /** The run of a deadline, else null. */
    readonly runId: string | null
    /** The last "run now" press on this item, or null. */
    readonly lastPress: OptionalDoorPress
}

/**
 * What "run now" did. `ran`: the item's own job was moved to now (its wake was written, or its deadline answered) and the workflow
 * goes on as if its time had come. `already_ran`: it fired already (its time came, someone pressed first, or it moved on since the list
 * was read). `not_scheduled`: nothing of that key is scheduled any more (the trigger is off, its next slot moved, the stop has no
 * deadline). `refused`: the run refused the deadline (the thread no longer waits). `invalid`: not an item key.
 */
export type RunNowOutcome = "ran" | "already_ran" | "not_scheduled" | "refused" | "invalid"

/** What "run now" answers: the outcome and the item it was about. */
export interface RunNowAnswer {
    /** How it ended. */
    readonly outcome: RunNowOutcome
    /** The item key as asked. */
    readonly id: string
}

/** The shop's care opt-out of a customer, as it stands. */
export interface CareOptOutView {
    /** The customer (lead). */
    readonly leadId: string
    /** True when nobody writes to the customer unprompted (care steps close themselves, customer sends are refused). */
    readonly optedOut: boolean
    /** The last time a person of the shop set or cleared it, or null (only the customer's own words set it). */
    readonly lastPress: OptionalDoorPress
}

/** What setting the opt-out did: `set` (written), `unchanged` (it already stood so; written again with who/when), `not_found`. */
export interface CareOptOutAnswer {
    /** How it ended. */
    readonly outcome: "set" | "unchanged" | "not_found"
    /** The opt-out as it stands after the call (null when the lead is not found). */
    readonly view: CareOptOutView | null
}
