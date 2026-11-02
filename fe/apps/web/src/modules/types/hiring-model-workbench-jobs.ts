import type { BadgeTone } from "@starci/grammar/common"
import type { FieldOf, HiringJobValues, HiringQuestionValues } from "./hiring"
import type { HiringWorkbenchCopy } from "./hiring-model-workbench-copy"
/** Readonly values of one actual editor question. */
export interface HiringQuestionData {
    readonly id: string
    readonly text: string
    readonly type: string
    readonly required: boolean
    readonly choices: string
    readonly expect: string
}
/** Readonly snapshot of the actual job form; the mutable form controller stays world-side. */
export interface HiringJobFormValues {
    readonly title: string
    readonly position: string
    readonly employmentType: string
    readonly schedule: string
    readonly payMin: number | null
    readonly payMax: number | null
    readonly payUnit: string
    readonly location: string
    readonly headcount: number
    readonly description: string
    readonly skills: string
    readonly years: number | null
    readonly experienceNote: string
    readonly availability: string
    readonly mustHave: string
    readonly niceToHave: string
    readonly questions: ReadonlyArray<HiringQuestionData>
    readonly channels: ReadonlyArray<string>
}
/** Resolved option facts supplied by the connected hiring owner. */
export interface HiringOption {
    readonly id: string
    readonly label: string
}
/** Resolved job row facts supplied by the connected hiring owner. */
export interface HiringJobRow {
    readonly id: string
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly facts: string
    readonly counts: string
    readonly publicUrl: string | null
    readonly copyLabel: string | null
    readonly transitions: ReadonlyArray<{ readonly to: string; readonly label: string; readonly isPrimary: boolean }>
}
/** Resolved job editor facts supplied by the connected hiring owner. */
export interface HiringJobEditorFields {
    readonly copy: HiringWorkbenchCopy
    readonly isNew: boolean
    readonly values: HiringJobFormValues
    readonly questions: ReadonlyArray<{ readonly question: HiringQuestionData; readonly numberLabel: string }>
    readonly employmentOptions: ReadonlyArray<HiringOption>
    readonly payUnitOptions: ReadonlyArray<HiringOption>
    readonly questionTypeOptions: ReadonlyArray<HiringOption>
    readonly channelOptions: ReadonlyArray<HiringOption>
    readonly canSave: boolean
    readonly canAddQuestion: boolean
    readonly isBusy: boolean
    readonly error: string | null
}
/** Callbacks for job editor interactions, bound by the connected hiring owner. */
export interface HiringJobEditorActions {
    readonly text: (name: FieldOf<HiringJobValues, string>, value: string) => void
    readonly number: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
    readonly list: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) => void
    readonly patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) => void
    readonly addQuestion: () => void
    readonly removeQuestion: (index: number) => void
    readonly save: () => void
    readonly close: () => void
}
/** The three actual stored ad variants, independent of transport definitions. */
export interface HiringAdData {
    readonly facebook: string
    readonly zalo: string
    readonly topcv: string
}
/** Resolved job ad facts supplied by the connected hiring owner. */
export interface HiringJobAdFields {
    readonly copy: HiringWorkbenchCopy
    readonly title: string
    readonly ads: HiringAdData | null
    readonly meta: string | null
    readonly publicUrl: string | null
    readonly publicLinkLabel: string | null
    readonly kindLabels: Readonly<Record<keyof HiringAdData, string>>
    readonly copiedId: string | null
    readonly isBusy: boolean
    readonly error: string | null
}
/** Callbacks for job ad interactions, bound by the connected hiring owner. */
export interface HiringJobAdActions {
    readonly generate: () => void
    readonly copy: (id: string, text: string) => void
    readonly close: () => void
}
/** Callbacks for job list interactions, bound by the connected hiring owner. */
export interface HiringJobListActions {
    readonly create: () => void
    readonly edit: (id: string) => void
    readonly openAd: (id: string) => void
    readonly copy: (id: string) => void
    readonly transition: (id: string, to: string) => void
}
/** Resolved jobs facts supplied by the connected hiring owner. */
export interface HiringJobsFields {
    readonly copy: HiringWorkbenchCopy
    readonly fact: string
    readonly rows: ReadonlyArray<HiringJobRow>
    readonly isBusy: boolean
    readonly error: string | null
    readonly isEditorOpen: boolean
    readonly editor: HiringJobEditorFields
    readonly isAdOpen: boolean
    readonly ad: HiringJobAdFields
}
/** Callbacks for jobs interactions, bound by the connected hiring owner. */
export interface HiringJobsActions {
    readonly list: HiringJobListActions
    readonly editor: HiringJobEditorActions
    readonly ad: HiringJobAdActions
}
