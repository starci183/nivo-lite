"use client"

import { useTranslations } from "next-intl"
import { NO_STAFF, ROLE_KEYS } from "@/hooks/team"
import type { TeamInviteDrawerState } from "@/hooks/teamInvite"
import type { TeamPanesBaseProps } from "@/modules/types"

/** Derived from the panes contract. */
type TeamInviteDrawerView = TeamPanesBaseProps["props"]["invite"]

/** The staff rows an invitation can link to, as the team read gave them. */
interface StaffChoices {
    readonly staffChoices: ReadonlyArray<{ readonly id: string; readonly name: string; readonly role: string }>
}

/** The catalog key of the sentence that says what was done with a made invitation. */
const SENT_KEYS = { invited: "sentEmail", existing: "sentNoticeExisting", none: "sentNoEmail" } as const

/** The invite drawer's words and values: the form, the invitation just made, and the notice an individual plan gets instead. */
export const useTeamInviteDrawerView = (
    drawer: TeamInviteDrawerState,
    team: StaffChoices,
    isIndividual: boolean,
): TeamInviteDrawerView => {
    const t = useTranslations("team")
    const { form, sent } = drawer
    return {
        isOpen: drawer.isOpen,
        isIndividual,
        title: t("formTitle"),
        description: t("formDesc"),
        closeLabel: t("close"),
        cancelLabel: t("confirmNo"),
        doneLabel: t("done"),
        emailLabel: t("fieldEmail"),
        roleLabel: t("fieldRole"),
        staffLabel: t("fieldStaff"),
        staffHint: t("staffHint"),
        submitLabel: t("submit"),
        failTitle: t("errGeneric"),
        roleOptions: [
            { value: "staff", label: t(ROLE_KEYS.staff) },
            { value: "manager", label: t(ROLE_KEYS.manager) },
        ],
        staffOptions: [
            { id: NO_STAFF, label: t("staffNone") },
            ...team.staffChoices.map((staff) => ({
                id: staff.id,
                label: staff.role === "" ? staff.name : t("staffOption", { name: staff.name, role: staff.role }),
            })),
        ],
        email: form.watch("email"),
        role: form.watch("role"),
        staffId: form.watch("staffId"),
        isPending: drawer.isPending,
        error: form.formState.errors.email?.message,
        sent:
            sent === undefined
                ? undefined
                : {
                      text: t(SENT_KEYS[sent.delivery], { email: sent.email }),
                      link: sent.link,
                      linkLabel: t("sentLink"),
                      copyLabel: t("inviteCopy"),
                      copiedLabel: t("inviteCopied"),
                      isCopied: drawer.isCopied,
                  },
        individual: { title: t("individualTitle"), body: t("individualText"), actionLabel: t("individualCta") },
    }
}
