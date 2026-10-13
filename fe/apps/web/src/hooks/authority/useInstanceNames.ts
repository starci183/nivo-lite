import { useQueryModuleInstallationsSwr } from "@/hooks/swr/api/graphql/queries/useQueryModuleInstallationsSwr"

/** Departments with several agent instances (one Chatbot per branch): their names; the rules are shared by every instance of a type. */
export const useInstanceNames = (): Readonly<Record<string, ReadonlyArray<string>>> => {
    const read = useQueryModuleInstallationsSwr()
    const names: Record<string, Array<string>> = {}
    for (const installation of read.data ?? []) {
        if (installation.isMulti)
            names[installation.moduleKey] = [...(names[installation.moduleKey] ?? []), installation.name]
    }
    return names
}
