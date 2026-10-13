import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQueryModuleInstallationsSwr } from "@/hooks/swr"
import type { DataSlot } from "@/modules/types"
import type { Installation } from "@/modules/installations"
import { toInstallations } from "./installations.shared"

/** Every installed agent of the active workspace (oldest first), read from the back end, with the way to read it again. */
export const useInstallations = (): {
    readonly slot: DataSlot<ReadonlyArray<Installation>>
    readonly installations: ReadonlyArray<Installation> | undefined
    readonly reload: () => void
} => {
    const read = useQueryModuleInstallationsSwr()
    const installations = useMemo(() => (read.data === undefined ? undefined : toInstallations(read.data)), [read.data])
    const reload = () => void read.mutate()
    return {
        slot: slotOfSwr({ data: installations, error: read.error, isLoading: read.isLoading }),
        installations,
        reload,
    }
}
