import { useLocale } from "next-intl"
import { MODULE_REGISTRY, pickCopy } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"

/** The full name of an agent type in the reader language. */
export const useModuleName = (module: ModuleKey): string =>
    pickCopy(MODULE_REGISTRY[module].name, useLocale() === "en" ? "en" : "vi")
