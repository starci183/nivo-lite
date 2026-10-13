import { useState } from "react"
import type { CommandActions } from "@/modules/documents"
import { mineOutcomeOf } from "@/modules/brain"
import type { MineOutcome } from "@/modules/brain"
import { useBrainCommand } from "./useBrainCommand"

/** The lesson form, as the person typed it. */
interface LessonDraft {
    readonly title: string
    readonly body: string
    readonly appliesWhen: string
}

const EMPTY_DRAFT: LessonDraft = { title: "", body: "", appliesWhen: "" }

/** What the lessons desk gives its block. */
interface LessonDesk {
    readonly agent: string
    readonly draft: LessonDraft
    readonly mined: MineOutcome | null
    readonly isPending: boolean
    readonly errorKey: string | null
    readonly setAgent: (value: string | null) => void
    readonly setTitle: (value: string) => void
    readonly setBody: (value: string) => void
    readonly setWhen: (value: string) => void
    readonly mine: () => void
    readonly save: () => void
    readonly decide: (id: string, action: "active" | "rejected" | "retired") => void
}

/** The desk where lessons are studied from corrections, written by hand and decided; the page reads again after each. */
export const useLessonDesk = (workspaceId: string, firstAgent: string, actions: CommandActions): LessonDesk => {
    const command = useBrainCommand(workspaceId, actions)
    const [agent, setAgent] = useState(firstAgent)
    const [draft, setDraft] = useState<LessonDraft>(EMPTY_DRAFT)
    const [mined, setMined] = useState<MineOutcome | null>(null)
    const note = command.note
    return {
        agent,
        draft,
        mined,
        isPending: command.isPending,
        errorKey: note?.tone === "negative" ? note.text : null,
        setAgent: (value) => setAgent(value ?? agent),
        setTitle: (title) => setDraft((now) => ({ ...now, title })),
        setBody: (body) => setDraft((now) => ({ ...now, body })),
        setWhen: (appliesWhen) => setDraft((now) => ({ ...now, appliesWhen })),
        mine: () => {
            setMined(null)
            command.send("lessons.mine", { module: agent }, { onResult: (result) => setMined(mineOutcomeOf(result)) })
        },
        save: () => {
            if (draft.title.trim() === "" || draft.body.trim() === "") return
            command.send(
                "lesson.save",
                {
                    module: agent === "" ? undefined : agent,
                    title: draft.title,
                    body: draft.body,
                    appliesWhen: draft.appliesWhen === "" ? undefined : draft.appliesWhen,
                },
                { onResult: () => setDraft(EMPTY_DRAFT) },
            )
        },
        decide: (id, action) => command.send("lesson.decide", { id, action }),
    }
}
