/**
 * The workflows cleared to run on threads in this phase of the move. Phase 0: the front desk only (its hand-offs make new wakes, so
 * consult and reconcile stay on the old engine). A later phase adds a name here once its stops, approvals and waits run on threads;
 * a name outside the list is refused at boot, so a typo or an early switch never moves a workflow the engine cannot carry yet.
 */
export const THREAD_READY_WORKFLOWS: ReadonlyArray<string> = ["chatbot.front-desk"]

/** A workflow as the flag names it: `<moduleKey>.<workflowKey>`. */
const WORKFLOW_NAME = /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/

/** What the flag's text names: the workflows, or the first name that may not be there. */
export type ThreadFlagRead =
    | {
          /** Every name is a workflow cleared for threads. */
          readonly kind: "workflows"
          /** The workflows, once each, in the order written. */
          readonly workflows: ReadonlyArray<string>
      }
    | {
          /** A name is no workflow name, or is not cleared for threads yet. */
          readonly kind: "invalid"
          /** That name. */
          readonly name: string
      }

/**
 * Reads the flag's text, a comma-separated list of `<moduleKey>.<workflowKey>`. No text, or only blanks and commas, names no
 * workflow: the flag is off and the old engine runs everything.
 */
export const threadFlagOf = (text: string | undefined): ThreadFlagRead => {
    const names = (text ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "")
    const invalid = names.find((name) => !WORKFLOW_NAME.test(name) || !THREAD_READY_WORKFLOWS.includes(name))
    return invalid === undefined ? { kind: "workflows", workflows: [...new Set(names)] } : { kind: "invalid", name: invalid }
}
