import { agentTypeName } from "@/modules/catalog"
import type { CopyLocale, ModuleKey } from "@/modules/catalog"
import type { Installation } from "@/modules/installations"

/** One agent instance a document may be kept for: "<type> - <instance>". */
export interface InstanceOption {
    readonly id: string
    readonly moduleKey: ModuleKey
    readonly label: string
}

/** "<type> - <instance>", unless the instance name already leads with the type; then the name alone says it. */
const labelOf = (type: string, name: string): string => {
    const lead = (type.split(/\s+/)[0] ?? "").toLowerCase()
    const own = name.toLowerCase()
    return lead !== "" && own.startsWith(lead) && own !== type.toLowerCase() ? name : `${type} - ${name}`
}

/** The agent instances a document may be kept for: only types with several instances have anything to choose. */
export const instanceOptions = (
    installations: ReadonlyArray<Installation>,
    locale: CopyLocale,
): ReadonlyArray<InstanceOption> =>
    installations
        .filter((one) => one.isMulti && installations.filter((other) => other.moduleKey === one.moduleKey).length > 1)
        .map((one) => ({
            id: one.id,
            moduleKey: one.moduleKey,
            label: labelOf(agentTypeName(one.moduleKey, locale), one.name),
        }))
