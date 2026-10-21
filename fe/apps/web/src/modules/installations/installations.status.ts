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

/** The filters of the catalogue by status. */
export const STATUS_FILTERS = ["all", "installed", "notInstalled", "early"] as const
const STATUS_FILTER_SET: ReadonlySet<unknown> = new Set(STATUS_FILTERS)

/** One status filter of the catalogue. */
export type StatusFilter = (typeof STATUS_FILTERS)[number]

/** Whether a text is a status filter of the catalogue. */
export const isStatusFilter = (value: string | null | undefined): value is StatusFilter => STATUS_FILTER_SET.has(value)

/** Accent-insensitive text for matching: NFD, marks stripped, d-stroke folded, lower case. */
export const foldText = (text: string): string =>
    text.normalize("NFD").replace(/[̀-ͯ]/gu, "").replace(/đ/giu, "d").toLowerCase()
