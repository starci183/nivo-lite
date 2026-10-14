import type { Origin } from "@modules/domain/work-items"

/** The language the automations write and log in. */
export const AUTOMATION_LOCALE = "vi"

/** The origin of a work item from the origin an automation names: anything but `simulated` is live. */
export const workOriginOf = (origin: string): Origin => (origin === "simulated" ? "simulated" : "live")
