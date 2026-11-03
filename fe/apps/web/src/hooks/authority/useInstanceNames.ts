import type { SlotRead, DataSlot } from "@/modules/types"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr"
import { displayNameOf } from "@/modules/installations"

/** The view `useInstanceNames` returns. */
export interface InstanceNamesView {
    read: SlotRead<Record<string, string[]> | undefined>
    slot: DataSlot<Record<string, string[]> | undefined>
    reload: () => undefined
}

/** Instance names preserve the installation read's loading, failure and settled empty states. */
export const useInstanceNames = (): InstanceNamesView => {
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
