"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { NO_ASSIGNEE } from "@/modules/brain"
import type {
    DialogKind,
    FindingDialogValues,
    FindingDialogView,
    FindingTextFieldView,
    FindingView,
    MemberOption,
} from "@/modules/brain"
import type { DossierReviewCommands } from "./useDossierReviewCommands"

/** The finding a dialog is about. */
interface DialogTarget {
    readonly kind: DialogKind
    readonly finding: FindingView
}

/** The words each dialog is headed and committed with. */
const DIALOG_WORDS = {
    dismiss: { title: "dismissTitle", submit: "dismiss" },
    done: { title: "markDoneTitle", submit: "markDone" },
    assign: { title: "assignTitle", submit: "assign" },
    draft: { title: "askDraft", submit: "askDraft" },
} as const

/** What each dialog that asks for text asks, and within which bounds (the back end takes 3 to 500 characters, instructions up to 1,000). */
const TEXT_FIELDS = {
    dismiss: { label: "dismissReason", hint: "dismissHint", isRequired: true, minLength: 3, maxLength: 500 },
    done: { label: "markDoneNote", hint: null, isRequired: true, minLength: 3, maxLength: 500 },
    draft: { label: "draftInstructions", hint: null, isRequired: false, minLength: 0, maxLength: 1000 },
} as const

type Commands = DossierReviewCommands

/** What the dialog of a finding gives its pane. */
interface FindingDialog {
    /** What the open dialog says; null while none is open. */
    readonly view: FindingDialogView | null
    readonly open: (kind: DialogKind, finding: FindingView) => void
    readonly close: () => void
    readonly submit: (values: FindingDialogValues) => Promise<void>
}

/**
 * The short tasks above the findings pane: dismiss with a reason, give to a member, mark done with a note, ask NIVO for a
 * draft. A dialog closes once its command went through; asking for a draft hands the new draft to the pane to open.
 */
export const useFindingDialog = (
    commands: Commands,
    members: ReadonlyArray<MemberOption>,
    onDrafted: (finding: FindingView, draftId: string) => void,
): FindingDialog => {
    const t = useTranslations("dossierReview")
    const [target, setTarget] = useState<DialogTarget | null>(null)
    const textFieldOf = (kind: DialogKind): FindingTextFieldView | null => {
        if (kind === "assign") return null
        const field = TEXT_FIELDS[kind]
        return {
            label: t(field.label),
            hint: field.hint === null ? undefined : t(field.hint),
            isRequired: field.isRequired,
            minLength: field.minLength,
            maxLength: field.maxLength,
        }
    }
    const viewOf = (current: DialogTarget): FindingDialogView => ({
        formId: "dossier-finding-dialog",
        title: t(DIALOG_WORDS[current.kind].title),
        closeLabel: t("close"),
        cancelLabel: t("cancel"),
        submitLabel: t(DIALOG_WORDS[current.kind].submit),
        isPending: commands.isPending,
        text: textFieldOf(current.kind),
        assign:
            current.kind === "assign"
                ? {
                      assigneeLabel: t("assignee"),
                      unassignedLabel: t("unassigned"),
                      dueLabel: t("dueDate"),
                      options: members,
                      assigneeId: current.finding.assigneeId ?? NO_ASSIGNEE,
                      dueAt: current.finding.dueAt,
                  }
                : null,
    })
    const run = async (current: DialogTarget, values: FindingDialogValues): Promise<boolean> => {
        const id = current.finding.id
        if (current.kind === "dismiss") return commands.dismiss(id, values.text)
        if (current.kind === "done") return commands.resolve(id, values.text)
        if (current.kind === "draft") {
            const draftId = await commands.askDraft(id, values.text)
            if (draftId !== undefined) onDrafted(current.finding, draftId)
            return draftId !== undefined
        }
        return commands.assign(
            id,
            values.assigneeId === NO_ASSIGNEE ? null : values.assigneeId,
            values.dueAt === "" ? null : values.dueAt,
        )
    }
    return {
        view: target === null ? null : viewOf(target),
        open: (kind, finding) => setTarget({ kind, finding }),
        close: () => setTarget(null),
        submit: async (values) => {
            if (target !== null && (await run(target, values))) setTarget(null)
        },
    }
}
