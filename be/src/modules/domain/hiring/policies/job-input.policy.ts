import type { JobQuestion, JobRequirements, QuestionExpect, QuestionType } from "../hiring.contracts"
import type { JobQuestionInput, JobRequirementsInput } from "../hiring-operations.contracts"
import { cleanTextList, clip } from "./text.policy"

/** The most questions a job keeps. */
const QUESTIONS_MAX = 12

/** The longest question text. */
const QUESTION_TEXT_MAX = 240

/** The most years of experience a job can ask. */
const YEARS_MAX = 50

/** A question id as the apply form posts it back. */
const QUESTION_ID = /^[a-z0-9_-]{1,24}$/iu

/** The channels a job can take applications from. */
const CHANNELS: ReadonlyArray<string> = ["page", "chat"]

/** The requirements as typed, cleaned: trimmed, bounded, years within range. */
export const cleanRequirements = (input: JobRequirementsInput | undefined): JobRequirements => {
    const years = input?.experienceYears
    return {
        skills: cleanTextList(input?.skills, 40, 200),
        experienceYears:
            typeof years === "number" && Number.isFinite(years) && years >= 0 ? Math.min(YEARS_MAX, years) : null,
        experienceNote: clip(input?.experienceNote ?? "", 300),
        availability: cleanTextList(input?.availability, 20, 80),
        mustHave: cleanTextList(input?.mustHave, 40, 200),
        niceToHave: cleanTextList(input?.niceToHave, 40, 200),
    }
}

const expectOf = (type: QuestionType, question: JobQuestionInput): QuestionExpect | undefined => {
    if (type === "yesno") return question.expectYesNo
    if (type === "number")
        return typeof question.expectNumber === "number" && Number.isFinite(question.expectNumber)
            ? question.expectNumber
            : undefined
    if (type === "choice" && question.expectChoices !== undefined) return cleanTextList(question.expectChoices, 12, 80)
    return undefined
}

/** The questions as typed, cleaned: empty ones dropped, ids kept when well formed, at most twelve. */
export const cleanQuestions = (input: ReadonlyArray<JobQuestionInput>): Array<JobQuestion> =>
    input
        .filter((question) => clip(question.text, QUESTION_TEXT_MAX) !== "")
        .slice(0, QUESTIONS_MAX)
        .map((question, index): JobQuestion => {
            const choices = question.type === "choice" ? cleanTextList(question.choices, 12, 80) : []
            const expect = expectOf(question.type, question)
            return {
                id: question.id !== undefined && QUESTION_ID.test(question.id) ? question.id : `q${index + 1}`,
                text: clip(question.text, QUESTION_TEXT_MAX),
                type: question.type,
                required: question.required,
                ...(choices.length > 0 ? { choices } : {}),
                ...(expect === undefined ? {} : { expect }),
            }
        })

/** The channels a job takes applications from: the known ones among those asked, the page alone when none is left. */
export const cleanChannels = (asked: ReadonlyArray<string> | undefined): Array<string> => {
    const known = (asked ?? CHANNELS).filter((channel) => CHANNELS.includes(channel))
    return known.length > 0 ? known : ["page"]
}

/** A pay amount: a non-negative finite number rounded to whole dong, otherwise none. */
export const cleanMoney = (value: number | null | undefined): number | null =>
    typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : null

/** The headcount kept within one to five hundred; one when none is given. */
export const cleanHeadcount = (value: number | undefined): number => Math.max(1, Math.min(500, Math.round(value ?? 1)))
