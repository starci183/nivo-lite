import type { ModuleIconName } from "@/modules/types"
import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { agentHref, agentListHref, installationLifecycleOf, instancesOf } from "@/modules/installations"
import { AGENTS_ROUTE } from "@/modules/routes"
import type { AgentTab, Installation, InstallationStatus, OperatingMode } from "@/modules/installations"

/** The wire row of the back end `moduleInstallations` query (text fields; the closed sets are checked here). */
interface InstallationWire {
    readonly id: string
    readonly workspaceId: string
    readonly moduleKey: string
    readonly name: string
    readonly isMulti: boolean
    readonly agentId?: string | null
    readonly agentName: string
    readonly agentAvatarUrl?: string | null
    readonly agentHandle: string
    readonly status: string
    readonly lifecycle: string
    readonly connectionNeeds: ReadonlyArray<{ readonly role: string; readonly providers: ReadonlyArray<string> }>
    readonly operatingMode: string
    readonly liveEnabled: boolean
    readonly activeContextVersionId?: string | null
    readonly activeVersion?: number | null
    readonly settings: unknown
    readonly createdAt: string
}

const STATUSES: ReadonlyArray<InstallationStatus> = [
    "installing",
    "setup",
    "ready",
    "live",
    "paused",
    "needs_connection",
]
const MODES: ReadonlyArray<OperatingMode> = ["assist", "autopilot"]

/** The closed status a wire text names; an unknown text reads as being set up. */
const statusOf = (value: string): InstallationStatus => STATUSES.find((status) => status === value) ?? "setup"

/** The operating mode a wire text names; an unknown text reads as assist, the safe one. */
export const operatingModeOf = (value: string): OperatingMode => MODES.find((mode) => mode === value) ?? "assist"

/** The settings object of a wire row; anything else reads as no settings. */
const settingsOf = (value: unknown): Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value))
        : {}

/** One installed agent as the screens read it, or none when the wire row names a module the catalogue does not know. */
const toInstallation = (row: InstallationWire): Installation | null =>
    isModuleKey(row.moduleKey)
        ? {
              id: row.id,
              workspaceId: row.workspaceId,
              moduleKey: row.moduleKey,
              name: row.name,
              isMulti: row.isMulti,
              agentId: row.agentId ?? null,
              agentName: row.agentName,
              agentAvatarUrl: row.agentAvatarUrl ?? null,
              agentHandle: row.agentHandle,
              status: statusOf(row.status),
              lifecycle: installationLifecycleOf(row.lifecycle),
              connectionNeeds: row.connectionNeeds,
              operatingMode: operatingModeOf(row.operatingMode),
              liveEnabled: row.liveEnabled,
              activeContextVersionId: row.activeContextVersionId ?? null,
              activeVersion: row.activeVersion ?? null,
              settings: settingsOf(row.settings),
              createdAt: row.createdAt,
          }
        : null

/** The installed agents of the wire rows, oldest first. */
export const toInstallations = (rows: ReadonlyArray<InstallationWire>): ReadonlyArray<Installation> =>
    rows
        .map(toInstallation)
        .filter((installation): installation is Installation => installation !== null)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** How a type-level url behaves: lead on (`page`), always stay on the list of instances (`list`), or always leave (`redirect`). */
export type TypeRouteMode = "page" | "list" | "redirect"

/** The query of a type-level url carried over to the instance url (the list flag stays behind). */
export const carriedQuery = (search: Readonly<Record<string, string | string[] | undefined>>): string => {
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(search)) {
        if (key === "list") continue
        const values = Array.isArray(value) ? value : [value]
        for (const one of values) if (one !== undefined) query.append(key, one)
    }
    return query.toString()
}

/**
 * Where a type-level url goes: the catalogue when the type is not installed, the only instance, else (several instances) the list
 * of instances, or null on the setup tab, which shows that list in place.
 */
export const typeTargetOf = (
    installations: ReadonlyArray<Installation>,
    module: ModuleKey,
    tab: AgentTab,
    query: string,
): string | null => {
    const instances = instancesOf(installations, module)
    if (instances.length === 0) return AGENTS_ROUTE
    const [only] = instances
    if (instances.length === 1 && only !== undefined) return agentHref(module, only.id, tab, query)
    return tab === "setup" ? null : agentListHref(module)
}

/** The glyph of an agent type; an unknown or missing key falls back to the chatbot glyph. */
export const moduleGlyphOf = (module: string | null): ModuleIconName =>
    isModuleKey(module) ? MODULE_REGISTRY[module].glyph : MODULE_REGISTRY.chatbot.glyph
