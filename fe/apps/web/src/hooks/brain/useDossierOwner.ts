"use client"

import { useState } from "react"
import { useFormatter, useTranslations } from "next-intl"
import { useMutateAssignBrainDossierSwr, useQueryWorkspaceMembersSwr } from "@/hooks/swr"
import { useWorkspaceId } from "@/hooks/workspaces"
import {
    NO_ASSIGNEE,
    memberOptionsOf,
    type DossierView,
    type FindingDialogValues,
    type FindingDialogView,
    type MemberOption,
} from "@/modules/brain"
import { toast } from "@/modules/toast"

/** No members yet: the read has not answered. */
const NO_OPTIONS: ReadonlyArray<MemberOption> = []

/** What the owner of a dossier gives the desk: the words of the two values, and the task that changes them. */
export interface DossierOwner {
    /** The task that gives the dossier to a member with a date; null while it is closed. */
    readonly dialog: FindingDialogView | null
    readonly open: () => void
    readonly close: () => void
    readonly submit: (values: FindingDialogValues) => void
    /** The owner's name, or "not given yet". */
    readonly ownerLabelOf: (dossier: DossierView) => string
    /** The due date in words, or a dash. */
    readonly dueLabelOf: (dossier: DossierView) => string
}

/** What the owner task reads: the dossier it is about and what to refresh once it is saved. */
interface DossierOwnerInput {
    /** The open dossier; null while none is open. */
    readonly dossier: DossierView | null
    readonly onSaved: () => void
}

/**
 * Who owns a dossier and by when: the two values the side pane shows, and the short task of the dossier's menu that sets them (an
 * active member of the workspace and a date, or neither). The task closes once the change went through.
 */
export const useDossierOwner = (input: DossierOwnerInput): DossierOwner => {
    const t = useTranslations("dossierReview")
    const desk = useTranslations("brainDossiers")
    const feedback = useTranslations("toast")
    const format = useFormatter()
    const workspaceId = useWorkspaceId()
    const people = useQueryWorkspaceMembersSwr(workspaceId)
    const save = useMutateAssignBrainDossierSwr()
    const [isOpen, setIsOpen] = useState(false)
    const options = people.data === undefined ? NO_OPTIONS : memberOptionsOf(people.data)
    const { dossier } = input
    const dialog: FindingDialogView | null =
        !isOpen || dossier === null
            ? null
            : {
                  formId: "dossier-owner-dialog",
                  title: desk("assignEntry"),
                  closeLabel: t("close"),
                  cancelLabel: t("cancel"),
                  submitLabel: desk("assignSubmit"),
                  isPending: save.isMutating,
                  text: null,
                  assign: {
                      assigneeLabel: t("assignee"),
                      unassignedLabel: t("unassigned"),
                      dueLabel: t("dueDate"),
                      options,
                      assigneeId: dossier.assigneeId ?? NO_ASSIGNEE,
                      dueAt: dossier.dueAt,
                  },
              }
    return {
        dialog,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        submit: (values) => {
            if (dossier === null) return
            save.trigger({
                dossierId: dossier.id,
                assigneeId: values.assigneeId === NO_ASSIGNEE ? null : values.assigneeId,
                dueAt: values.dueAt === "" ? null : values.dueAt,
            }).then(
                () => {
                    setIsOpen(false)
                    input.onSaved()
                },
                () => {
                    toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
                },
            )
        },
        ownerLabelOf: (one) =>
            one.assigneeId === null
                ? t("unassigned")
                : (options.find((option) => option.id === one.assigneeId)?.label ?? "—"),
        dueLabelOf: (one) => (one.dueAt === null ? "—" : format.dateTime(new Date(one.dueAt), { dateStyle: "medium" })),
    }
}
