import type { FactScope, FactSubjectType } from "@/modules/types"

/** One key fact worth adding, with the form it opens. */
export interface FactPreset {
    readonly subjectType: FactSubjectType
    readonly subjectLabel: string
    readonly attributeLabel: string
    readonly scope: FactScope
    /** A knowledge gap this fact answers: the question stays in view in the form, and the gap is marked answered on save. */
    readonly gapId?: string
    readonly question?: string
}
