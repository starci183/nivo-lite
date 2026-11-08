import { useGraphQLWithToast } from "@/modules/toast"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { type HiringOwner, useHiringRun } from "@/hooks/hiring"
import type { UseFormReturn } from "react-hook-form"
import type { JobView } from "@/hooks/hiringWire"
import { useMutateSaveHiringJobSwr } from "@/hooks/swr"
import { MAX_QUESTIONS, blankQuestion, toJobInput } from "./hiringJobs.shared"
import type { FieldOf, HiringJobValues, HiringQuestionValues } from "@/modules/types"

const FIELD_OPTIONS = { shouldValidate: true, shouldDirty: true }

/** The view `useHiringJobEditor` returns. */
export interface HiringJobEditorView {
    values: HiringJobValues
    isValid: boolean
    isPending: boolean
    error: string | null
    canAddQuestion: boolean
    setText: (name: FieldOf<HiringJobValues, string>, value: string) => void
    setNumber: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
    setList: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) => void
    patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) => void
    addQuestion: () => void
    removeQuestion: (index: number) => void
    save: () => void
}

/** The job editor: the form values, every change of them, and the save that closes the editor once the back end took the job. */
export const useHiringJobEditor = (
    form: UseFormReturn<HiringJobValues>,
    job: JobView | null,
    onClose: () => void,
    owner?: HiringOwner,
): HiringJobEditorView => {
    const run = useHiringRun(owner)
    const runGraphQL = useGraphQLWithToast()
    const lifetime = useFeatureLifetime(owner?.isActive ?? true, owner?.scope ?? "")
    const { trigger } = useMutateSaveHiringJobSwr()
    const values = form.watch()
    const questions = values.questions
    const submit = (isCurrent: () => boolean) =>
        form.handleSubmit((submitted) => {
            if (!isCurrent()) return
            run.dispatch(
                () => trigger(toJobInput(submitted, job?.id ?? null)),
                undefined,
                () => {
                    if (isCurrent()) onClose()
                },
            )
        })
    return {
        values,
        isValid: form.formState.isValid,
        isPending: run.isPending || form.formState.isSubmitting,
        error: run.error,
        canAddQuestion: questions.length < MAX_QUESTIONS,
        setText: (name: FieldOf<HiringJobValues, string>, value: string) => form.setValue(name, value, FIELD_OPTIONS),
        setNumber: (name: FieldOf<HiringJobValues, number | null>, value: number | null) =>
            form.setValue(name, value, FIELD_OPTIONS),
        setList: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) =>
            form.setValue(name, value, FIELD_OPTIONS),
        patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) =>
            form.setValue(
                "questions",
                questions.map((question, at) => (at === index ? { ...question, ...patch } : question)),
            ),
        addQuestion: () => form.setValue("questions", [...questions, blankQuestion()]),
        removeQuestion: (index: number) =>
            form.setValue(
                "questions",
                questions.filter((_, at) => at !== index),
            ),
        save: () => {
            const isCurrent = lifetime.capture()
            if (!isCurrent()) return
            submit(isCurrent)().catch((error) => runGraphQL(() => Promise.reject(error), { showSuccessToast: false }))
        },
    }
}
