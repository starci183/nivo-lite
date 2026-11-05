import type { useFormatter, useTranslations } from "next-intl"
import { SCOPE_KEY, TYPE_KEY } from "./labels"
import type { FactWords } from "./fact-entries"
import type { LessonFilter, LessonWords } from "./lesson-entries"
import type { BrainPageHeaderView, FactScope, FactSource } from "@/modules/types"

type Brain = ReturnType<typeof useTranslations<"brain">>
type Facts = ReturnType<typeof useTranslations<"brainFacts">>
type Lessons = ReturnType<typeof useTranslations<"brainLessons">>
type Formatter = ReturnType<typeof useFormatter>

/** The catalog key (`brainFacts` namespace) of the line that says who sees a fact in each scope. */
const SCOPE_LINE_KEY = {
    public: "scopeLinePublic",
    internal: "scopeLineInternal",
    restricted: "scopeLineRestricted",
} as const satisfies Readonly<Record<FactScope, string>>

/** The catalog key of the words that say where a fact came from. */
const SOURCE_KEY = {
    owner: "sourceOwner",
    manager: "sourceManager",
    document: "sourceDocument",
    system: "sourceSystem",
    staff: "sourceStaff",
    customer: "sourceCustomer",
    ai: "sourceAi",
} as const satisfies Readonly<Record<FactSource, string>>

/** The words and day formats the facts list is made of, resolved once for the viewer's language. */
export const factWordsOf = (t: Brain, f: Facts, format: Formatter): FactWords => ({
    typeOf: (type) => t(TYPE_KEY[type]),
    scopeOf: (scope) => t(SCOPE_KEY[scope]),
    scopeLineOf: (scope, agents) =>
        scope === "restricted" && agents === "" ? f("scopeHintRestricted") : f(SCOPE_LINE_KEY[scope], { agents }),
    sourceOf: (source) => f(SOURCE_KEY[source]),
    onlyAgents: (agents) => f("onlyAgents", { agents }),
    proposalLine: f("proposalLine"),
    validityNone: f("validityNone"),
    headLine: f("headLine"),
    valueLabel: f("valueLabel"),
    termType: f("termType"),
    termScope: f("termScope"),
    termValidity: f("termValidity"),
    termSource: f("termSource"),
    termAddedBy: f("termAddedBy"),
    addedBy: (who, date) => f("addedBy", { who, date }),
    sinceOf: (date) => f("since", { date }),
    untilOf: (date) => f("until", { date }),
    betweenOf: (from, to) => f("between", { from, to }),
    scheduledOf: (date) => f("scheduled", { date }),
    retireLabel: t("retire"),
    editLabel: t("editValue"),
    historyTitle: f("historyTitle"),
    historyNow: f("historyNow"),
    historyReplaced: f("historyReplaced"),
    historyExpired: f("historyExpired"),
    historyScheduled: f("historyScheduled"),
    day: (iso) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit", year: "numeric" }),
    dayShort: (iso) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" }),
})

/** The catalog key (`brainLessons` namespace) of the word for each status a lesson is filed under. */
const STATUS_KEY = {
    proposed: "statusProposed",
    active: "statusActive",
    retired: "statusRetired",
} as const satisfies Readonly<Record<LessonFilter, string>>

/** The line under the title of an opened lesson: its status, how many corrections it stands on, and the agent it is for. */
const headLine = (l: Lessons, filter: LessonFilter, corrections: number, agent: string): string => {
    if (filter === "active") return l("headActive", { agent })
    if (filter === "retired") return l("headRetired", { agent })
    return corrections > 0 ? l("headProposed", { count: corrections, agent }) : l("headProposedNone", { agent })
}

/** The words and the day format the lessons list is made of, resolved once for the viewer's language. */
export const lessonWordsOf = (l: Lessons, format: Formatter): LessonWords => ({
    allAgents: l("allAgents"),
    statusOf: (filter) => l(STATUS_KEY[filter]),
    headOf: (filter, corrections, agent) => headLine(l, filter, corrections, agent),
    termLesson: l("termLesson"),
    termDo: l("termDo"),
    termWhen: l("termWhen"),
    termAgent: l("termAgent"),
    evidenceTitle: l("evidenceTitle"),
    correctionOf: (agent) => l("correction", { agent }),
    bylineOf: (agent, date) => l("byline", { agent, date }),
    footnote: l("footnote"),
    applyLabel: l("apply"),
    skipLabel: l("skip"),
    retireLabel: l("retire"),
    day: (iso) => format.dateTime(new Date(iso), { day: "2-digit", month: "2-digit" }),
})

/** The add command a list tab puts in the header: its words, its address and who may use it. */
interface HeaderAdd {
    readonly canWrite: boolean
    readonly label: string
    readonly href: string
}

/** The header of a list tab: the add command is the form of the tab, for the members who may write. */
export const headerWithAdd = (base: BrainPageHeaderView, add: HeaderAdd): BrainPageHeaderView => ({
    ...base,
    actions: { ...base.actions, add: add.canWrite ? { label: add.label, href: add.href } : null },
})
