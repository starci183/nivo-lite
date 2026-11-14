import { CONVERSATION_MESSAGE_MANIFEST } from "@modules/domain/channels/customer-message-native.service"
import { CONTACT_TOOLS_MANIFEST } from "@modules/domain/contact-tools/contact-tools-native.service"
import { isLockedContextRead } from "@modules/domain/context-sources"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { pluginToolManifestsOf } from "@modules/domain/native-tools/plugin-tools-native.service"
import { lockedArgumentsOf, type LockedSubjectClaims } from "@modules/domain/tools/locked-arguments.policy"
import type { ManifestTool, ToolArgument } from "@modules/domain/tools/tools.contracts"

/** The full id of a manifest entry: its connector namespace and its name. */
const idOf = (namespace: string, tool: ManifestTool): string => `${namespace}.${tool.name}`

/**
 * The locked context reads as the app SERVES them, by full id, each with the argument schema the gateway and its executor validate a call
 * with (`ToolRegistryService.call`): the engine's own families (the thread read, the contact read) and every installed package's
 * declarations (`PLUGIN_TOOLS`: the sales lead reads).
 */
export const SERVED_READS: ReadonlyMap<string, ManifestTool> = new Map([
    ...CONVERSATION_MESSAGE_MANIFEST.tools.map((tool): [string, ManifestTool] => [idOf(CONVERSATION_MESSAGE_MANIFEST.namespace ?? "", tool), tool]),
    ...CONTACT_TOOLS_MANIFEST.tools.map((tool): [string, ManifestTool] => [idOf(CONTACT_TOOLS_MANIFEST.namespace ?? "", tool), tool]),
    ...pluginToolManifestsOf(INSTALLED).map((tool): [string, ManifestTool] => [idOf("nivo.tool", tool), tool]),
])

/** Why the real door and the real gateway would refuse a call before its executor, or null when they would let it through. */
export type DoorRefusal = string | null

/**
 * What the REAL door and gateway do to a locked context read before any executor runs (ruling R51 item 1), for a world that answers the
 * read itself: the door's real lock and fill (`lockedArgumentsOf`: another run's id refused, the run's own subject filled in), then the
 * SERVED schema's validation (`invalid_arguments`). Null for a call both would let through, and for any tool that is no locked read.
 */
export const doorRefusalOf = (tool: string, args: unknown, claims: LockedSubjectClaims): DoorRefusal => {
    const served = SERVED_READS.get(tool)
    if (!isLockedContextRead(tool) || served === undefined || typeof args !== "object" || args === null || Array.isArray(args)) return null
    const given: Readonly<Record<string, ToolArgument>> = Object.fromEntries(Object.entries(args))
    const locked = lockedArgumentsOf(tool, claims, given)
    if (locked.kind === "refused") return locked.reason
    return served.argumentSchema?.safeParse(locked.args).success === false ? "invalid_arguments" : null
}
