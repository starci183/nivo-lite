"use client"

import { useMemo } from "react"
import { useQueryModuleRequirementFactsSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import { MODULE_REGISTRY, type ModuleKey } from "@/modules/catalog"
import { unmetRequirementsOf, type UnmetRequirement } from "./setupRequirements.shared"

/** The requirements of a module the workspace does not meet yet; none while the facts load or when they cannot be read. */
export const useSetupRequirements = (moduleKey: ModuleKey): ReadonlyArray<UnmetRequirement> => {
    const { data } = useQueryModuleRequirementFactsSwr()
    const workspaceId = useWorkspaceId()
    const requires = MODULE_REGISTRY[moduleKey].requires
    return useMemo(
        () => (data === undefined ? [] : unmetRequirementsOf(requires, data, workspaceId)),
        [data, requires, workspaceId],
    )
}
