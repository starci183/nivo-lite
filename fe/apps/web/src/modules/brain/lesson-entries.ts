import type {
    BrainChipView,
    BrainFilterView,
    BrainEvidence,
    BrainLens,
    BrainLesson,
    LessonActionView,
    LessonDetailView,
    LessonEntryView,
} from "@/modules/types"
import { filterTabsOf } from "./entries"

/** The status a lesson is filed under in the tabs: a skipped one reads as stopped. */
export type LessonFilter = "proposed" | "active" | "retired"

/** The resolved words and day format the entries of the lessons list are made of. */
export interface LessonWords {
    readonly allAgents: string
    readonly statusOf: (filter: LessonFilter) => string
    readonly headOf: (filter: LessonFilter, corrections: number, agent: string) => string
    readonly termLesson: string
    readonly termDo: string
    readonly termWhen: string
    readonly termAgent: string
    readonly evidenceTitle: string
    readonly correctionOf: (agent: string) => string
    readonly bylineOf: (agent: string, date: string) => string
    readonly footnote: string
    readonly applyLabel: string
    readonly skipLabel: string
    readonly retireLabel: string
    readonly day: (iso: string) => string
}

/** What the lessons of the list are read against. */
export interface LessonEntriesInput {
    readonly lessons: ReadonlyArray<BrainLesson>
    readonly lenses: ReadonlyArray<BrainLens>
    readonly canWrite: boolean
    /** The decision being sent, as `<lesson>:<action>`. */
    readonly pending: string | undefined
    readonly words: LessonWords
}

const FILTER_OF: Readonly<Record<BrainLesson["status"], LessonFilter>> = {
    proposed: "proposed",
    active: "active",
    retired: "retired",
    rejected: "retired",
}

const CHIP_TONE: Readonly<Record<LessonFilter, BrainChipView["tone"]>> = {
    proposed: "info",
    active: "success",
    retired: "neutral",
}

/** The filters the tabs may offer, in the order they are drawn. */
const LESSON_FILTERS: ReadonlyArray<LessonFilter> = ["proposed", "active", "retired"]

/** The status a lesson is filed under. */
const lessonFilterOf = (lesson: BrainLesson): LessonFilter => FILTER_OF[lesson.status]

/** The name of the agent a lesson is for. */
const agentNameOf = (lesson: BrainLesson, input: LessonEntriesInput): string =>
    lesson.module === null
        ? input.words.allAgents
        : (input.lenses.find((lens) => lens.module === lesson.module)?.name ?? lesson.module)

/** One command of a lesson, with its pending state; the others wait while it runs. */
const actionOf = (
    lesson: BrainLesson,
    id: string,
    label: string,
    intent: LessonActionView["intent"],
    pending?: string,
) => ({
    id,
    label,
    intent,
    isPending: pending === `${lesson.id}:${id}`,
})

/** What an owner can do with a lesson: apply or skip a proposed one, stop using one in force. */
const actionsOf = (lesson: BrainLesson, input: LessonEntriesInput): ReadonlyArray<LessonActionView> => {
    if (!input.canWrite) return []
    const words = input.words
    if (lesson.status === "proposed") {
        return [
            actionOf(lesson, "skip", words.skipLabel, "neutral", input.pending),
            actionOf(lesson, "apply", words.applyLabel, "commit", input.pending),
        ]
    }
    return lesson.status === "active" ? [actionOf(lesson, "retire", words.retireLabel, "neutral", input.pending)] : []
}

/** The correction a piece of evidence stands for: the owner's reply when it was kept, else a plain sentence, and when. */
const evidenceOf = (lesson: BrainLesson, agent: string, input: LessonEntriesInput): LessonDetailView["evidence"] =>
    lesson.evidence.map((one: BrainEvidence, index) => ({
        id: `${one.ref}:${index}`,
        text: one.quote ?? input.words.correctionOf(agent),
        byline: one.at === undefined ? agent : input.words.bylineOf(agent, input.words.day(one.at)),
    }))

/** The opened lesson: what it says, the corrections it stands on and its commands. */
const detailOf = (lesson: BrainLesson, agent: string, input: LessonEntriesInput): LessonDetailView => {
    const words = input.words
    const evidence = evidenceOf(lesson, agent, input)
    return {
        terms: [
            { id: "lesson", term: words.termLesson, text: lesson.title },
            { id: "do", term: words.termDo, text: lesson.body },
            ...(lesson.appliesWhen === "" ? [] : [{ id: "when", term: words.termWhen, text: lesson.appliesWhen }]),
            { id: "agent", term: words.termAgent, text: agent },
        ],
        evidenceTitle: words.evidenceTitle,
        evidence,
        actions: actionsOf(lesson, input),
        footnote: words.footnote,
    }
}

/** The rows of the lessons list, proposed ones first, each with the detail that opens beside it. */
export const lessonEntriesOf = (input: LessonEntriesInput): ReadonlyArray<LessonEntryView> =>
    input.lessons
        .toSorted((left, right) => Number(right.status === "proposed") - Number(left.status === "proposed"))
        .map((lesson) => {
            const filter = lessonFilterOf(lesson)
            const agent = agentNameOf(lesson, input)
            const badge: BrainChipView = { label: input.words.statusOf(filter), tone: CHIP_TONE[filter] }
            return {
                id: lesson.id,
                filter,
                title: lesson.title,
                line: lesson.body,
                badge,
                head: {
                    title: lesson.title,
                    description: input.words.headOf(filter, lesson.evidence.length, agent),
                    badge,
                },
                detail: detailOf(lesson, agent, input),
            }
        })

/** The tabs of the lessons list: all of them, then each status that has lessons. */
export const lessonFilterTabsOf = (
    entries: ReadonlyArray<LessonEntryView>,
    all: string,
    statusOf: LessonWords["statusOf"],
): ReadonlyArray<BrainFilterView> =>
    filterTabsOf(
        entries,
        all,
        LESSON_FILTERS.map((filter) => ({ id: filter, label: statusOf(filter) })),
    )

/** The rows of the lessons list while the first read waits: the static words are the real ones, every value is empty. */
export const lessonPlaceholderOf = (words: LessonWords): ReadonlyArray<LessonEntryView> =>
    ["a", "b", "c", "d", "e", "f"].map((id) => {
        const badge: BrainChipView = { label: "", tone: "neutral" }
        return {
            id,
            filter: "all",
            title: "",
            line: "",
            badge,
            head: { title: "", description: "", badge },
            detail: {
                terms: [
                    { id: "lesson", term: words.termLesson, text: "" },
                    { id: "do", term: words.termDo, text: "" },
                    { id: "when", term: words.termWhen, text: "" },
                    { id: "agent", term: words.termAgent, text: "" },
                ],
                evidenceTitle: words.evidenceTitle,
                evidence: [{ id: "one", text: undefined, byline: "" }],
                actions: [],
                footnote: words.footnote,
            },
        }
    })
