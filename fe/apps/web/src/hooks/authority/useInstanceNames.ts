import type { SlotRead } from "@/modules/types"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr"
import { displayNameOf } from "@/modules/installations"

/** Instance names preserve the installation read's loading, failure and settled empty states. */
export const useInstanceNames = () => {
    const read = useQueryModuleInstallationsSwr()
    const names: Record<string, Array<string>> | undefined = read.data === undefined ? undefined : {}
    if (names !== undefined && read.data !== undefined) {
        for (const installation of read.data) {
            if (installation.isMulti)
                names[installation.moduleKey] = [...(names[installation.moduleKey] ?? []), displayNameOf(installation)]
        }
    }
    const namesRead: SlotRead<typeof names> = {
        data: names,
        error: read.error,
        isLoading: read.isLoading,
        isValidating: read.isValidating,
    }
    return { read: namesRead, slot: slotOfSwr(namesRead), reload: () => void read.mutate() }
}
