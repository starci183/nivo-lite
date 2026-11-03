import type { MutateAcceptTemplateUpdateRequest } from "@/modules/api/graphql/mutations/mutation-accept-template-update"

/** The words a buyer writes as the values of a template: a JSON object of numbers, texts and yes or no, or nothing. */
export const valuesOfText = (text: string): Record<string, number | string | boolean> | null => {
    if (text.trim() === "") return {}
    try {
        const parsed: unknown = JSON.parse(text)
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
        return Object.fromEntries(
            Object.entries(parsed).flatMap(([key, member]): Array<[string, number | string | boolean]> =>
                typeof member === "number" || typeof member === "string" || typeof member === "boolean"
                    ? [[key, member]]
                    : [],
            ),
        )
    } catch {
        return null
    }
}

/** The ids of the units of an offer that are safe to take at once: the ones the buyer never touched, and what the creator added. */
export const safeUnitIds = (units: ReadonlyArray<{ readonly id: string; readonly change: string }>): Array<string> =>
    units.filter((unit) => unit.change === "upgrade" || unit.change === "added").map((unit) => unit.id)

/** The input of the accept mutation. */
export const acceptInputOf = (installationId: string, unitIds: Array<string>): MutateAcceptTemplateUpdateRequest => ({
    installationId,
    unitIds,
})
