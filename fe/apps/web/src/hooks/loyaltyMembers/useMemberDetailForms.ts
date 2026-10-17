"use client"

import {
    LOYALTY_ADJUST_REASON_MAX,
    LOYALTY_MEMBER_NAME_MAX,
    LOYALTY_MEMBER_NOTE_MAX,
    inputToIso,
    isoToInput,
    parseSigned,
} from "@/hooks/loyalty"
import { useLoyaltyAdjustForm, useLoyaltyMemberForm } from "@/hooks/rhf"
import type { LoyaltyMemberType } from "@/hooks/swr"
import { useFormatter, useTranslations } from "next-intl"
import type { useMemberActions } from "./useMemberActions"

/** What the forms of the member page need to know. */
interface MemberDetailFormsInput {
    readonly memberId: string
    readonly member: LoyaltyMemberType | undefined
    readonly canManage: boolean
    readonly actions: ReturnType<typeof useMemberActions>
}

/** The details form (managers) or the read-only facts (staff), and the point adjustment form, wired to the member mutations. */
export const useMemberDetailForms = (input: MemberDetailFormsInput) => {
    const t = useTranslations("loyalty")
    const format = useFormatter()
    const { member, actions } = input
    const editForm = useLoyaltyMemberForm({
        name: member?.name ?? "",
        birthday: isoToInput(member?.birthday ?? null),
        note: member?.note ?? "",
    })
    const adjustForm = useLoyaltyAdjustForm()
    const adjustValues = adjustForm.watch()
    const adjustPoints = parseSigned(adjustValues.points)
    const nameError = editForm.formState.errors.name?.message
    const birthdayError = editForm.formState.errors.birthday?.message
    const pointsError = adjustValues.points === "" ? undefined : adjustForm.formState.errors.points?.message
    const edit = (value: "name" | "birthday" | "note", max: number) => (text: string) =>
        editForm.setValue(value, text.slice(0, max), { shouldValidate: true, shouldDirty: true })
    const submitEdit = editForm.handleSubmit((values) =>
        actions.save({
            name: values.name.trim(),
            birthday: inputToIso(values.birthday) ?? null,
            note: values.note.trim(),
        }),
    )
    const submitAdjust = adjustForm.handleSubmit((values) => {
        const amount = parseSigned(values.points)
        if (amount === null || amount === 0) return
        actions.adjust(amount, values.reason.trim(), () => adjustForm.reset())
    })
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
        onName: edit("name", LOYALTY_MEMBER_NAME_MAX),
        onBirthday: edit("birthday", 10),
        onNote: edit("note", LOYALTY_MEMBER_NOTE_MAX),
        onSubmit: () => void submitEdit(),
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
        onPoints: (text: string) =>
            adjustForm.setValue("points", text.replace(/[^\d+\-\s]/g, "").slice(0, 8), {
                shouldValidate: true,
                shouldDirty: true,
            }),
        onReason: (text: string) =>
            adjustForm.setValue("reason", text.slice(0, LOYALTY_ADJUST_REASON_MAX), {
                shouldValidate: true,
                shouldDirty: true,
            }),
        onSubmit: () => void submitAdjust(),
    }
    const readOnly = readOnlyOf(t, member, format)
    return {
        adjust: adjustProps,
        edit: input.canManage ? editProps : undefined,
        readOnly: input.canManage ? undefined : readOnly,
        reset: () => {
            editForm.reset()
            adjustForm.reset()
        },
    }
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
    member:
        | {
              birthday: string | null
              email: string | null
              id: string
              joinedAt: string
              lastVisitAt: string | null
              lifetimeSpendVnd: number
              name: string
              note: string
              phone: string | null
              points: number
              tierKey: string | null
              visits: number
          }
        | undefined,
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
