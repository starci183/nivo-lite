import type { Installation, InstallationLifecycle } from "./installations.types"

/** The lifecycle an agent shows: the one the back end names, or not installed. */
export type AgentLifecycle = InstallationLifecycle | "notInstalled"

/** The badge tone of each lifecycle. */
export const AGENT_LIFECYCLE_TONE: Readonly<Record<AgentLifecycle, "neutral" | "accent" | "success" | "warning">> = {
    notInstalled: "neutral",
    needs_setup: "warning",
    setting_up: "warning",
    needs_connection: "warning",
    paused: "neutral",
    ready: "accent",
    running: "success",
    removed: "neutral",
}

/** The one view-model of how an installed agent reads in lists, rails and the header: the lifecycle of the back end. */
export const agentLifecycleOf = (installation: Installation | null | undefined): AgentLifecycle =>
    installation?.lifecycle ?? "notInstalled"

/** The badge tone of a lifecycle. */
export const agentLifecycleTone = (lifecycle: AgentLifecycle): (typeof AGENT_LIFECYCLE_TONE)[AgentLifecycle] =>
    AGENT_LIFECYCLE_TONE[lifecycle]

/** The two name fields a back end installation row holds. */
interface NamedInstallationRow {
    readonly agentName: string
    readonly name: string
}

/**
 * The one display name of an installed agent: the name of its agent, else the instance label the back end keeps beside it. The back
 * end holds both fields; the screens get only this one, so the header, Settings, the profile and the chat can never disagree.
 */
export const displayNameOf = (row: NamedInstallationRow): string =>
    row.agentName.trim() === "" ? row.name : row.agentName

/** True while an agent has no applied setup: it is not set up or being set up, so it cannot run, answer or show a live version. */
export const isSetupPending = (lifecycle: AgentLifecycle | null): boolean =>
    lifecycle === "needs_setup" || lifecycle === "setting_up"

/** The key (in the agent words) of the button that sends the owner to Setup: start it, or carry on with it. */
export const setupLabelKey = (lifecycle: AgentLifecycle): "setupStart" | "continueSetup" =>
    lifecycle === "setting_up" ? "continueSetup" : "setupStart"

/** The name an installed agent answers to: its one display name, else its handle. */
export const installationPersonName = (installation: Installation): string =>
    [installation.name, installation.agentHandle].find((name) => name.trim() !== "") ?? ""

/** Accent-insensitive text for matching: NFD, marks stripped, d-stroke folded, lower case. */
export const foldText = (text: string): string =>
    text.normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/đ/giu, "d").toLowerCase()

/** The parts of the facts line under an agent name. */
type AgentSubtitleParts = {
    readonly handle: string
    readonly roleName: string
    readonly channels: ReadonlyArray<string>
}

/** The facts line under an agent name: "@handle - role - channels", the parts that exist joined by a middle dot. */
export const agentSubtitleOf = (parts: AgentSubtitleParts): string =>
    [parts.handle === "" ? "" : `@${parts.handle}`, parts.roleName, parts.channels.join(", ")]
        .filter((part) => part !== "")
        .join(" · ")

const LIFECYCLES: ReadonlyArray<InstallationLifecycle> = [
    "needs_setup",
    "setting_up",
    "needs_connection",
    "paused",
    "ready",
    "running",
    "removed",
]

/** The closed lifecycle a wire text names; an unknown text reads as needing setup, the safe one: it never claims to be running. */
export const installationLifecycleOf = (value: string): InstallationLifecycle =>
    LIFECYCLES.find((lifecycle) => lifecycle === value) ?? "needs_setup"
