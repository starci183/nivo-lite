import type { Installation } from "@/lib/modules-shared"
import { moduleName } from "@/lib/module-registry"
import type { InstanceOption } from "./AddDocumentsDrawer"

/**
 * "<type> – <instance>", unless the instance's own name already leads with the type ("Chatbot – Chi nhánh Q1"): then the name alone says it.
 * An instance still named like its type keeps the full form, so it is never the same label as the "every <type>" option.
 */
const labelOf = (type: string, name: string): string => {
  const lead = (type.split(/\s+/)[0] ?? "").toLowerCase()
  const own = name.toLowerCase()
  return lead !== "" && own.startsWith(lead) && own !== type.toLowerCase() ? name : `${type} – ${name}`
}

/**
 * The agent instances a document may be kept for: only types with several instances (one Chatbot per branch or Fanpage) - a type with
 * one instance has nothing to choose. Shared by Tài liệu and Second Brain so both Add documents drawers offer the same "For" list.
 */
export const instanceOptions = (installations: ReadonlyArray<Installation>, locale: Parameters<typeof moduleName>[1]): Array<InstanceOption> =>
  installations
    .filter((i) => i.isMulti && installations.filter((j) => j.moduleKey === i.moduleKey).length > 1)
    .map((i) => ({ id: i.id, moduleKey: i.moduleKey, label: labelOf(moduleName(i.moduleKey, locale), i.name) }))
