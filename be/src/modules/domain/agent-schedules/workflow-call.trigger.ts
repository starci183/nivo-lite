import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import type { OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"

/*
 * THE WORKFLOW CALL'S TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): a run's `callWorkflow` hand-off, a declared
 * job's start of a workflow, or the team chat's turn, as ONE canonical event for the callee agent. Pure: the translate reads only its
 * argument. The event's `data` is exactly what the caller mapped (the callee's declared input, `supply: caller`), flat. The workflow the
 * call names and its version are the delivery's pin (`DeliveredEvent.pin`), never part of the event; the caller's person rides beside
 * the event too (`contactId`), the key.
 */

/** The trigger's name. */
export const WORKFLOW_CALLED = "workflow.called"

/** One call: the caller's once-key and the params the caller mapped. */
export type WorkflowCallRaw = {
    readonly key: string
    readonly params: Readonly<Record<string, unknown>>
}

/** The data of a call: the callee's params exactly as the caller mapped them. */
export type WorkflowCalledData = Readonly<Record<string, unknown>>

/** The translate: one event per caller key, its data the callee's params. */
export const translateWorkflowCall = (raw: WorkflowCallRaw): OptionalCanonicalEvent<WorkflowCalledData> => {
    if (raw.key === "") return null
    return { id: raw.key, data: { ...raw.params } }
}

/** The workflow call's declaration, keyed by the caller's person (the contact the call names). */
export const WORKFLOW_CALL_TRIGGER: TriggerDeclaration<WorkflowCallRaw, WorkflowCalledData> = {
    provider: PROVIDER.nivo,
    name: WORKFLOW_CALLED,
    verb: TRIGGER.workflowCalled,
    via: "internal",
    raw: z.object({ key: z.string(), params: z.record(z.string(), z.unknown()) }),
    data: z.record(z.string(), z.unknown()),
    translate: translateWorkflowCall,
    key: { by: "contact" },
    settle: null,
}
