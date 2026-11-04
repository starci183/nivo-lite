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
import { useTranslations } from "next-intl"
import { useMemberDetailFormView, type MemberDetailFormsInput } from "./useMemberDetailFormView"
import { useFeatureReset } from "@/hooks/reuseables"
import { toast } from "@/modules/toast"

/** The view `useMemberDetailForms` returns. */
export interface MemberDetailFormsView {
    on: {
        edit: {
            onName: (text: string) => void
            onBirthday: (text: string) => void
            onNote: (text: string) => void
            onSubmit: () => void
        }
        adjust: {
            onPoints: (text: string) => void
            onReason: (text: string) => void
            onSubmit: () => void
        }
    }
    reset: () => void
    adjust: {
        isPending: boolean
        note?: string
        canSubmit: boolean
        pointsLabel: string
        pointsHint: string
        pointsPlaceholder: string
        reasonLabel: string
        submitLabel: string
        pointsError?: string
        label: string
        memberId: string
        points: string
        reason: string
    }
    edit:
        | {
              noteMax: number
              saveLabel: string
              isPending: boolean
              nameLabel: string
              birthdayLabel: string
              birthdayPlaceholder: string
              birthdayHint: string
              noteLabel: string
              birthdayError?: string
              nameError?: string
              label: string
              memberId: string
              name: string
              birthday: string
              note: string
          }
        | undefined
    readOnly:
        | {
              items: {
                  id: string
                  term: string
                  description: string
              }[]
              note: string
          }
        | undefined
}

/** The details form (managers) or the read-only facts (staff), and the point adjustment form, wired to the member mutations. */
export const useMemberDetailForms = (input: MemberDetailFormsInput): MemberDetailFormsView => {
    const feedback = useTranslations("toast")
    const { member, actions } = input
    const editForm = useLoyaltyMemberForm({
        name: member?.name ?? "",
        birthday: isoToInput(member?.birthday ?? null),
        note: member?.note ?? "",
    })
    const adjustForm = useLoyaltyAdjustForm()
    const reset = () => {
        editForm.reset()
        adjustForm.reset()
    }
    useFeatureReset({
        ...input.activation,
        scope: JSON.stringify([input.activation.scope, input.memberId]),
        onReset: reset,
    })
    const failed = () => {
        toast.danger(feedback("errorTitle"), { description: feedback("defaultError") })
    }
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
    const view = useMemberDetailFormView({ input, editForm, adjustForm })
    return {
        ...view,
        on: {
            edit: {
                onName: edit("name", LOYALTY_MEMBER_NAME_MAX),
                onBirthday: edit("birthday", 10),
                onNote: edit("note", LOYALTY_MEMBER_NOTE_MAX),
                onSubmit: () => {
                    submitEdit().catch(failed)
                },
            },
            adjust: {
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
                onSubmit: () => {
                    submitAdjust().catch(failed)
                },
            },
        },
        reset,
    }
}
