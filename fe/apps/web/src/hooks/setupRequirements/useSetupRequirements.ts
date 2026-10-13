import { useMemo } from "react"
import { useQueryModuleRequirementFactsSwr } from "@/hooks/swr/api/graphql/queries/useQueryModuleRequirementFactsSwr"
import { MODULE_REGISTRY } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { unmetRequirementsOf } from "./setupRequirements.shared"
import type { UnmetRequirement } from "./setupRequirements.shared"

/** The requirements of a module the workspace does not meet yet; none while the facts load or when they cannot be read. */
export const useSetupRequirements = (moduleKey: ModuleKey): ReadonlyArray<UnmetRequirement> => {
    const { data } = useQueryModuleRequirementFactsSwr()
    const requires = MODULE_REGISTRY[moduleKey].requires
    return useMemo(() => (data === undefined ? [] : unmetRequirementsOf(requires, data)), [data, requires])
}
