/** The durable queue of the automations engine: its minute ticks. */
export const AUTOMATION_QUEUE = "automation"

/** The job of a minute tick: run the due runs, the scans and the extension ticks of every workspace. */
export const AUTOMATION_TICK_JOB = "automation.tick"

/** The job of one command from the screen (its payload is `{ commandId }`, the row of `automation_commands`): write the shop's own wording of a template, or run a scheduled workflow now. */
export const AUTOMATION_COMMAND_JOB = "automation.command"
