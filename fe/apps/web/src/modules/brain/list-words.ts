import type { useTranslations } from "next-intl"
import type { LessonFilter, LessonWords } from "./lesson-entries"
import type { BrainPageHeaderView } from "@/modules/types"

type Lessons = ReturnType<typeof useTranslations<"brainLessons">>

/** A day as `dd/MM` (or `dd/MM/yyyy`), the way the shop writes it, in the viewer's time zone. */
const dayOf = (iso: string, withYear: boolean): string => {
    const date = new Date(iso)
    const day = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`
    return withYear ? `${day}/${date.getFullYear()}` : day
}

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
export const lessonWordsOf = (l: Lessons): LessonWords => ({
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
    day: (iso) => dayOf(iso, false),
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
