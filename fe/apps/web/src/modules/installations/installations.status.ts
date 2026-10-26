import type { Installation, InstallationStatus } from "./installations.types"

/** The status an agent shows in lists and the frame: its installation status, or not installed. */
type ShownStatus = InstallationStatus | "notInstalled"

/** The status of an installation that may not exist. */
export const agentStatusOf = (installation: Installation | null | undefined): ShownStatus =>
    installation?.status ?? "notInstalled"

/** The tone of the badge of each status. */
export const AGENT_STATUS_TONE: Readonly<Record<ShownStatus, "neutral" | "accent" | "success" | "warning" | "danger">> =
    {
        notInstalled: "neutral",
        installing: "neutral",
        setup: "warning",
        ready: "accent",
        live: "success",
        paused: "neutral",
        needs_connection: "warning",
    }

/** The lifecycle of an agent as the business rules name it (the BE `lifecycle` field), or not installed. */
export type AgentLifecycle = "needs_setup" | "needs_connection" | "paused" | "ready" | "running" | "notInstalled"

/** The badge tone of each lifecycle. */
export const AGENT_LIFECYCLE_TONE: Readonly<Record<AgentLifecycle, "neutral" | "accent" | "success" | "warning">> = {
    notInstalled: "neutral",
    needs_setup: "warning",
    needs_connection: "warning",
    paused: "neutral",
    ready: "accent",
    running: "success",
}

/**
 * The one view-model of how an installed agent reads in lists, rails and the header. Until the BE sends `lifecycle` it is derived
 * from the status: `running` only when the agent really runs (status `live` and the live switch on). Swap this derivation for the
 * wire field and every badge follows.
 */
export const agentLifecycleOf = (installation: Installation | null | undefined): AgentLifecycle => {
    if (installation === null || installation === undefined) return "notInstalled"
    switch (installation.status) {
        case "live":
            return installation.liveEnabled ? "running" : "ready"
        case "ready":
            return "ready"
        case "paused":
            return "paused"
        case "needs_connection":
            return "needs_connection"
        case "installing":
        case "setup":
            return "needs_setup"
    }
}

/** The badge tone of a lifecycle. */
export const agentLifecycleTone = (lifecycle: AgentLifecycle): (typeof AGENT_LIFECYCLE_TONE)[AgentLifecycle] =>
    AGENT_LIFECYCLE_TONE[lifecycle]

/** The name an installed agent answers to: its own human name, else the instance label. */
export const installationPersonName = (installation: Installation): string =>
    [installation.agentName, installation.agentHandle, installation.name].find((name) => name.trim() !== "") ?? ""

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
