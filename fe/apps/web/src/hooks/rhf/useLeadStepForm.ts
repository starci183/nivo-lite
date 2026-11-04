"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"
import type { LeadStepMode, LeadStepValues } from "@/modules/types"
import type {
    FormState,
    Control,
    UseFormWatch,
    UseFormUnregister,
    UseFormTrigger,
    UseFormSubscribe,
    UseFormSetValues,
    UseFormSetValue,
    UseFormSetFocus,
    UseFormSetError,
    UseFormResetField,
    UseFormResetDefaultValues,
    UseFormReset,
    UseFormRegister,
    UseFormHandleSubmit,
    UseFormGetValues,
    UseFormGetFieldState,
    UseFormClearErrors,
} from "react-hook-form"

type UseLeadStepFormResult = {
    fields: LeadStepValues
    formLabels: Readonly<Record<LeadStepMode, string>>
    submitLabels: Readonly<Record<LeadStepMode, string>>
    watch: UseFormWatch<LeadStepValues>
    getValues: UseFormGetValues<LeadStepValues>
    getFieldState: UseFormGetFieldState<LeadStepValues>
    setError: UseFormSetError<LeadStepValues>
    clearErrors: UseFormClearErrors<LeadStepValues>
    setValue: UseFormSetValue<LeadStepValues>
    setValues: UseFormSetValues<LeadStepValues>
    trigger: UseFormTrigger<LeadStepValues>
    formState: FormState<LeadStepValues>
    resetField: UseFormResetField<LeadStepValues>
    reset: UseFormReset<LeadStepValues>
    resetDefaultValues: UseFormResetDefaultValues<LeadStepValues>
    onSubmit: UseFormHandleSubmit<LeadStepValues, LeadStepValues>
    unregister: UseFormUnregister<LeadStepValues>
    control: Control<LeadStepValues, unknown, LeadStepValues>
    register: UseFormRegister<LeadStepValues>
    setFocus: UseFormSetFocus<LeadStepValues>
    subscribe: UseFormSubscribe<LeadStepValues>
}

/** Validates the next-step form before a responsibility mutation runs. */
export const useLeadStepForm = (mode: LeadStepMode | null): UseLeadStepFormResult => {
    const t = useTranslations("lead")
    const schema = useMemo(
        () =>
            z.object({
                title:
                    mode === "add"
                        ? z.string().trim().min(1, t("errStepTitle")).max(200, t("errStepTitle"))
                        : z.string(),
                owner: z.string().trim().min(1, t("errStepOwner")),
                nextAction: z.string().trim().min(1, t("errStepNext")).max(1000, t("errStepNext")),
                due: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/, t("errStepDue"))
                    .nullable(),
            }),
        [mode, t],
    )
    const form = useForm<LeadStepValues>({
        resolver: zodResolver(schema),
        defaultValues: { title: "", owner: "human", nextAction: "", due: null },
    })
    const values = useWatch({ control: form.control })
    const { handleSubmit: onSubmit, ...rest } = form
    return { ...rest, onSubmit, ...stepFormInputs(values, t) }
}

/** Normalizes watched fields and supplies the labels for each edit mode. */
const stepFormInputs = (values: Partial<LeadStepValues>, t: ReturnType<typeof useTranslations<"lead">>) => {
    const fields: LeadStepValues = {
        title: values.title ?? "",
        owner: values.owner ?? "human",
        nextAction: values.nextAction ?? "",
        due: values.due ?? null,
    }
    const formLabels: Readonly<Record<LeadStepMode, string>> = {
        add: t("formAdd"),
        due: t("formDue"),
        reassign: t("formReassign"),
    }
    const submitLabels: Readonly<Record<LeadStepMode, string>> = {
        add: t("addStep"),
        due: t("saveDue"),
        reassign: t("saveChanges"),
    }

    return { fields, formLabels, submitLabels }
}
