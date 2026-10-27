/** Resolves a word of the `hiring` catalog; the connected block hands it to its drawing half. */
export type HiringSay = (key: string, values?: Record<string, string | number>) => string

/** The names of the fields of a form whose value is of one kind (every string field, every number field...). */
export type FieldOf<Values, Kind> = {
    [Name in keyof Values]: Values[Name] extends Kind ? Name : never
}[keyof Values]

/** One question in the editor: the choices and the expected answer are the text the owner types. */
export interface HiringQuestionValues {
    id: string
    text: string
    type: string
    required: boolean
    choices: string
    expect: string
}

/** The values of the job editor form. */
export interface HiringJobValues {
    title: string
    position: string
    employmentType: string
    schedule: string
    payMin: number | null
    payMax: number | null
    payUnit: string
    location: string
    headcount: number
    description: string
    skills: string
    years: number | null
    experienceNote: string
    availability: string
    mustHave: string
    niceToHave: string
    questions: Array<HiringQuestionValues>
    channels: Array<string>
}

/** The text and numeric changes shared by the basic and requirement job fields. */
export interface HiringJobFieldCommands {
    readonly onText: (name: FieldOf<HiringJobValues, string>, value: string) => void
    readonly onNumber: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
}

/** One question of a public job. */
export interface PublicQuestionView {
    readonly id: string
    readonly text: string
    readonly type: string
    readonly required: boolean
    readonly choices: ReadonlyArray<string>
}

/** The values of the apply form. */
export interface ApplyValues {
    name: string
    phone: string
    email: string
    availability: Array<string>
    availabilityText: string
    answers: Record<string, string>
    consent: boolean
    website: string
}
