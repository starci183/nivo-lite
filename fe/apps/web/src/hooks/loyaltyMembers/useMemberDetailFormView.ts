import { LOYALTY_MEMBER_NOTE_MAX, parseSigned, type LoyaltyPanelActivation } from "@/hooks/loyalty"
import type { useLoyaltyAdjustForm, useLoyaltyMemberForm } from "@/hooks/rhf"
import type { LoyaltyMemberType } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import type { useMemberActions } from "./useMemberActions"
import type { MemberDetailFormsView } from "./useMemberDetailForms"

/** What the forms of the member page need to know. */
export interface MemberDetailFormsInput {
    readonly memberId: string
    readonly member: LoyaltyMemberType | undefined
    readonly canManage: boolean
    readonly actions: ReturnType<typeof useMemberActions>
    readonly activation: LoyaltyPanelActivation
}

/** Resolves the editProps labels for the current locale. */
const editPropsLabelsOf = (t: ReturnType<typeof useTranslations<"loyalty">>) => ({
    nameLabel: t("fieldName"),
    birthdayLabel: t("fieldBirthday"),
    birthdayPlaceholder: t("birthdayPlaceholder"),
    birthdayHint: t("birthdayHint"),
    noteLabel: t("fieldNote"),
})

const readOnlyOf = (
    t: ReturnType<typeof useTranslations<"loyalty">>,
    member: LoyaltyMemberType | undefined,
    format: ReturnType<typeof useFormatter>,
) => {
    return {
        items: [
            {
                id: "birthday",
                term: t("fieldBirthday"),
                description:
                    member?.birthday === null || member?.birthday === undefined
                        ? t("none")
                        : format.dateTime(new Date(member.birthday), {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              timeZone: "Asia/Ho_Chi_Minh",
                          }),
            },
            {
                id: "note",
                term: t("fieldNote"),
                description: member === undefined || member.note === "" ? t("none") : member.note,
            },
        ],
        note: t("readOnlyNote"),
    }
}

/** Labels of the points adjustment form. */
const adjustmentLabelsOf = (t: ReturnType<typeof useTranslations<"loyalty">>) => ({
    pointsLabel: t("adjustPoints"),
    pointsHint: t("adjustPointsHint"),
    pointsPlaceholder: "+50",
    reasonLabel: t("adjustReason"),
    submitLabel: t("adjustSubmit"),
})

interface FormViewContext {
    readonly input: MemberDetailFormsInput
    readonly editForm: ReturnType<typeof useLoyaltyMemberForm>
    readonly adjustForm: ReturnType<typeof useLoyaltyAdjustForm>
}
/** Projects only the two forms' atom fields and read-only facts; event functions remain with the form owner. */
export const useMemberDetailFormView = ({
    input,
    editForm,
    adjustForm,
}: FormViewContext): Pick<MemberDetailFormsView, "adjust" | "edit" | "readOnly"> => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const { member, actions } = input
    const adjustValues = adjustForm.watch()
    const adjustPoints = parseSigned(adjustValues.points)
    const nameError = editForm.formState.errors.name?.message
    const birthdayError = editForm.formState.errors.birthday?.message
    const pointsError = adjustValues.points === "" ? undefined : adjustForm.formState.errors.points?.message

    const editProps = {
        label: t("editTitle"),
        memberId: input.memberId,
        name: editForm.watch("name"),
        birthday: editForm.watch("birthday"),
        note: editForm.watch("note"),
        ...(nameError === undefined ? {} : { nameError }),
        ...(birthdayError === undefined ? {} : { birthdayError }),
        ...editPropsLabelsOf(t),
        noteMax: LOYALTY_MEMBER_NOTE_MAX,
        saveLabel: t("save"),
        isPending: actions.isPending,
    }
    const adjustProps = {
        label: t("adjustTitle"),
        memberId: input.memberId,
        points: adjustValues.points,
        reason: adjustValues.reason,
        ...(pointsError === undefined ? {} : { pointsError }),
        ...adjustmentLabelsOf(t),
        canSubmit: adjustPoints !== null && adjustPoints !== 0 && adjustValues.reason.trim() !== "",
        ...(actions.adjustNote === null ? {} : { note: actions.adjustNote }),
        isPending: actions.isPending,
    }
    const readOnly = readOnlyOf(t, member, format)

    return {
        adjust: adjustProps,
        edit: input.canManage ? editProps : undefined,
        readOnly: input.canManage ? undefined : readOnly,
    }
}
