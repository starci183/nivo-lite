import type {
    Answer,
    ExperienceFamily,
    JobQuestion,
    JobRecord,
    ReasonStatus,
    ScoreLabel,
    ScoreReason,
    ScreenedPerson,
    Screening,
    TextOf,
} from "../hiring.contracts"
import { scrubProtected } from "./fairness.policy"
import { firstNumber, fold } from "./text.policy"

/** What the screening reads of a job: its written requirements and its questions. */
type Screened = Pick<JobRecord, "requirements" | "questions">

/** One scored line before it joins the checklist. */
interface Entry extends ScoreReason {
    /** How much the line counts. */
    readonly weight: number
    /** Whether an unmet line is a must-have. */
    readonly must: boolean
}

const REQUIRED_WEIGHT = 2
const OPTIONAL_WEIGHT = 1
const SKILL_WEIGHT = 2
const NOT_FIT_SCORE = 30
const FIT_SCORE = 70
const UNKNOWN_SHARE = 0.5
const TOKEN_MIN = 3
const TOKEN_SHARE = 0.6
const QUESTION_LABEL_MAX = 80
const ANSWER_QUOTE_MAX = 80
const MONTHS_PER_YEAR = 12
const PERCENT = 100
const TENTH = 10

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)

/** True when the folded haystack contains the folded needle at a word start. */
const has = (haystack: string, needle: string): boolean => {
    const folded = fold(needle).trim()
    return folded.length > 0 && new RegExp(`(?<![a-z0-9])${escapeRegExp(folded)}`, "u").test(haystack)
}

const YES = /^(?:co|vang|da|ok|yes|y|duoc|dong y|co a|co ah|roi)\b/u
const NO = /^(?:khong|ko|k|no|n|chua|khong co|khong duoc)\b/u

/** Reads a typed answer as yes or no; null when it is neither. */
const parseYesNo = (answer: string): "yes" | "no" | null => {
    const folded = fold(answer).trim()
    if (YES.test(folded)) return "yes"
    return NO.test(folded) ? "no" : null
}

/** The longest experience a text states, in years ("2 nam", "18 thang"); null when it states none. */
const experienceYears = (text: string): number | null => {
    const years = [
        ...fold(text)
            .replace(/,/gu, ".")
            .matchAll(/(\d+(?:\.\d+)?)\s*(nam|thang|year|month)/gu),
    ].map((found) => Number(found[1]) / (found[2] === "thang" || found[2] === "month" ? MONTHS_PER_YEAR : 1))
    return years.length === 0 ? null : Math.max(...years)
}

const entry = (criterion: string, status: ReasonStatus, note: string, weight: number, must: boolean): Entry => ({
    criterion,
    status,
    note,
    weight,
    must,
})

const clipText = (text: string, max: number): string => (text.length > max ? `${text.slice(0, max - 3)}...` : text)

/** One scored question against the answer given. */
const questionEntry = (question: JobQuestion, given: string, t: TextOf): Entry => {
    const weight = question.required ? REQUIRED_WEIGHT : OPTIONAL_WEIGHT
    const label = clipText(question.text, QUESTION_LABEL_MAX)
    const make = (status: ReasonStatus, key: string, params: Record<string, string | number> = {}): Entry =>
        entry(label, status, t(key, params), weight, question.required)
    const quote = given.slice(0, ANSWER_QUOTE_MAX)
    if (given === "") return make("unknown", "hiring.screen.unanswered")
    if (question.type === "yesno") {
        const said = parseYesNo(given)
        if (said === null) return make("unknown", "hiring.screen.yesnoUnclear", { answer: quote })
        if (said === question.expect)
            return make("met", said === "yes" ? "hiring.screen.yesnoYes" : "hiring.screen.yesnoNoOk")
        return make("unmet", said === "yes" ? "hiring.screen.yesnoNeedNo" : "hiring.screen.yesnoNeedYes")
    }
    if (question.type === "number" && typeof question.expect === "number") {
        const number = firstNumber(given)
        if (number === null) return make("unknown", "hiring.screen.numberNone", { answer: quote })
        return make(
            number >= question.expect ? "met" : "unmet",
            number >= question.expect ? "hiring.screen.numberOk" : "hiring.screen.numberLow",
            {
                n: number,
                need: question.expect,
            },
        )
    }
    const accepted = Array.isArray(question.expect) ? question.expect : []
    const ok = accepted.some((choice) => fold(choice) === fold(given) || has(fold(given), choice))
    return make(ok ? "met" : "unmet", ok ? "hiring.screen.choiceOk" : "hiring.screen.choiceBad", {
        answer: quote,
        need: accepted.join(", "),
    })
}

const answerOf = (answers: ReadonlyArray<Answer>, question: JobQuestion): string =>
    answers.find((answer) => answer.questionId === question.id)?.answer.trim() ?? ""

const questionEntries = (job: Screened, person: ScreenedPerson, t: TextOf): Array<Entry> =>
    job.questions
        .filter((question) => question.expect !== undefined)
        .map((question) => questionEntry(question, answerOf(person.answers, question), t))

const skillEntries = (job: Screened, text: string, t: TextOf): Array<Entry> =>
    job.requirements.skills
        .filter((skill) => skill.trim() !== "")
        .map((skill) =>
            entry(
                t("hiring.screen.skill", { skill }),
                has(text, skill) ? "met" : "unknown",
                t(has(text, skill) ? "hiring.screen.skillMet" : "hiring.screen.skillUnknown", {}),
                SKILL_WEIGHT,
                false,
            ),
        )

const experienceEntries = (job: Screened, text: string, t: TextOf): Array<Entry> => {
    const need = job.requirements.experienceYears
    const asked = job.questions.some(
        (question) =>
            question.type === "number" && /kinh nghiem/u.test(fold(question.text)) && question.expect !== undefined,
    )
    if (need === null || need <= 0 || asked) return []
    const got = experienceYears(text)
    const criterion = t("hiring.screen.experience", { years: need })
    if (got === null)
        return [entry(criterion, "unknown", t("hiring.screen.experienceUnknown", {}), SKILL_WEIGHT, false)]
    const years = Math.round(got * TENTH) / TENTH
    return [
        entry(
            criterion,
            got >= need ? "met" : "unmet",
            t("hiring.screen.experienceGot", { years }),
            SKILL_WEIGHT,
            false,
        ),
    ]
}

const availabilityEntries = (job: Screened, person: ScreenedPerson, text: string, t: TextOf): Array<Entry> => {
    const wanted = job.requirements.availability
    if (wanted.length === 0) return []
    const hay = fold(`${person.availability} ${text}`)
    const hits = wanted.filter((item) => has(hay, item))
    const criterion = t("hiring.screen.availability", { list: wanted.join(", ") })
    if (person.availability.trim() === "" && hits.length === 0) {
        return [entry(criterion, "unknown", t("hiring.screen.availUnknown", {}), SKILL_WEIGHT, false)]
    }
    if (hits.length > 0) {
        return [entry(criterion, "met", t("hiring.screen.availMet", { hits: hits.join(", ") }), SKILL_WEIGHT, false)]
    }
    return [
        entry(
            criterion,
            "unmet",
            t("hiring.screen.availUnmet", { given: person.availability.slice(0, ANSWER_QUOTE_MAX) }),
            SKILL_WEIGHT,
            false,
        ),
    ]
}

const tokensOf = (text: string): Array<string> =>
    fold(text)
        .split(/[^a-z0-9]+/u)
        .filter((token) => token.length >= TOKEN_MIN)

const wishEntries = (
    items: ReadonlyArray<string>,
    key: string,
    weight: number,
    text: string,
    t: TextOf,
): Array<Entry> =>
    items.flatMap((item) => {
        const tokens = tokensOf(item)
        if (tokens.length === 0) return []
        const ok = tokens.filter((token) => text.includes(token)).length / tokens.length >= TOKEN_SHARE
        return [
            entry(
                t(key, { item }),
                ok ? "met" : "unknown",
                t(ok ? "hiring.screen.mentioned" : "hiring.screen.notMentioned", {}),
                weight,
                false,
            ),
        ]
    })

const labelOf = (score: number, total: number, unmetMust: number, unknown: number, count: number): ScoreLabel => {
    if (total === 0) return "consider"
    if (unmetMust > 0 || (score < NOT_FIT_SCORE && unknown / Math.max(1, count) < UNKNOWN_SHARE)) return "not_fit"
    return score >= FIT_SCORE ? "fit" : "consider"
}

/**
 * Scores one candidate against the written requirements of the job only (skills, experience, availability, must-haves, scored questions).
 * Nothing about the person (name, phone, source, anything protected) is read. The score is advisory and never rejects anybody: a met line adds its
 * weight, an unmet or unknown line adds nothing, and only an explicit "no" or a too-low number makes a line unmet.
 */
export const screenAgainstRequirements = (job: Screened, person: ScreenedPerson, t: TextOf): Screening => {
    const text = fold(person.answers.map((answer) => scrubProtected(answer.answer)).join(" \n "))
    const entries = [
        ...questionEntries(job, person, t),
        ...skillEntries(job, text, t),
        ...experienceEntries(job, text, t),
        ...availabilityEntries(job, person, text, t),
        ...wishEntries(job.requirements.mustHave, "hiring.screen.mustHave", REQUIRED_WEIGHT, text, t),
        ...wishEntries(job.requirements.niceToHave, "hiring.screen.niceToHave", OPTIONAL_WEIGHT, text, t),
    ]
    const total = entries.reduce((sum, line) => sum + line.weight, 0)
    const met = entries.filter((line) => line.status === "met").reduce((sum, line) => sum + line.weight, 0)
    const unmetMust = entries.filter((line) => line.status === "unmet" && line.must).length
    const unknown = entries.filter((line) => line.status === "unknown").length
    const score = total === 0 ? 0 : Math.round((PERCENT * met) / total)
    return {
        score,
        label: labelOf(score, total, unmetMust, unknown, entries.length),
        reasons: entries.map(({ criterion, status, note }) => ({ criterion, status, note })),
    }
}

/** The experience line of a text about a job: the years asked with the note, the note alone, or nothing. `family` names the catalog group (criteria or facts). */
export const experienceLine = (years: number | null, note: string, family: ExperienceFamily, t: TextOf): string => {
    const facts = family === "facts"
    if (years !== null && years > 0) {
        const yearsKey = facts ? "hiring.facts.experienceYears" : "hiring.criteria.experienceYears"
        return t(yearsKey, { years, note: note === "" ? "" : ` (${note})` })
    }
    return note === "" ? "" : t(facts ? "hiring.facts.experienceNote" : "hiring.criteria.experienceNote", { note })
}

/** A short plain description of the job criteria: what the model is told to compare against. */
export const criteriaText = (
    job: Pick<JobRecord, "title" | "requirements" | "employmentType" | "schedule" | "location">,
    t: TextOf,
): string => {
    const requirements = job.requirements
    const where = [t(`hiring.employment.${job.employmentType}`, {}), job.schedule, job.location]
        .filter((part) => part !== "")
        .join(", ")
    const experience = experienceLine(requirements.experienceYears, requirements.experienceNote, "criteria", t)
    return [
        t("hiring.criteria.position", { title: job.title, where }),
        requirements.skills.length > 0 ? t("hiring.criteria.skills", { list: requirements.skills.join(", ") }) : "",
        experience,
        requirements.availability.length > 0
            ? t("hiring.criteria.availability", { list: requirements.availability.join(", ") })
            : "",
        requirements.mustHave.length > 0
            ? t("hiring.criteria.mustHave", { list: requirements.mustHave.join("; ") })
            : "",
        requirements.niceToHave.length > 0
            ? t("hiring.criteria.niceToHave", { list: requirements.niceToHave.join("; ") })
            : "",
    ]
        .filter((line) => line !== "")
        .join("\n")
}
