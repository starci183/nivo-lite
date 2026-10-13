import { useMemo } from "react"
import { slotOfSwr } from "@/hooks/slot"
import { useQuerySetupVersionsSwr } from "@/hooks/swr/api/graphql/queries/useQuerySetupVersionsSwr"
import type { ContextVersion } from "@/modules/installations"
import type { DataSlot } from "@/modules/types"
import { toContextVersion } from "./agentSetup.shared"

/** The applied versions of an instance, newest first, and the one in use. */
export interface SetupVersionsView {
    readonly versions: ReadonlyArray<ContextVersion>
    readonly activeVersionId: string | null
}

/** Reads the applied context versions of an instance. */
export const useSetupVersions = (installationId: string): DataSlot<SetupVersionsView> => {
    const read = useQuerySetupVersionsSwr({ installationId })
    const view = useMemo(
        (): SetupVersionsView | undefined =>
            read.data === undefined
                ? undefined
                : {
                      versions: read.data.versions.map(toContextVersion),
                      activeVersionId: read.data.activeVersionId ?? null,
                  },
        [read.data],
    )
    return slotOfSwr({ data: view, error: read.error, isLoading: read.isLoading })
}
