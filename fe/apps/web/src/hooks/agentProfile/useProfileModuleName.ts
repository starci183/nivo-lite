"use client"

import { useModuleName } from "@/hooks/installations"
import { isModuleKey } from "@/modules/catalog"

/** The name of the module an agent works for, in the reader language; a module the catalog does not know says its key. */
export const useProfileModuleName = (module: string | undefined): string => {
    const known = module !== undefined && isModuleKey(module) ? module : null
    const catalogName = useModuleName(known)
    return known === null ? (module ?? "") : catalogName
}
