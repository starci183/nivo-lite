import type { UseFormReturn } from "react-hook-form"
import { useHiringRun } from "@/hooks/hiring"
import type { FieldOf } from "@/hooks/hiring"
import type { JobView } from "@/hooks/hiringWire"
import { useMutateSaveHiringJobSwr } from "@/hooks/swr/api/graphql/mutations/useMutateSaveHiringJobSwr"
import { MAX_QUESTIONS, blankQuestion, toJobInput } from "./hiringJobs.shared"
import type { HiringJobValues, HiringQuestionValues } from "./hiringJobs.shared"

const FIELD_OPTIONS = { shouldValidate: true, shouldDirty: true }

/** The job editor: the form values, every change of them, and the save that closes the editor once the back end took the job. */
export const useHiringJobEditor = (form: UseFormReturn<HiringJobValues>, job: JobView | null, onClose: () => void) => {
    const run = useHiringRun()
    const { trigger } = useMutateSaveHiringJobSwr()
    const values = form.watch()
    const questions = values.questions
    const submit = form.handleSubmit(async (submitted) => {
        const saved = await run.exec(() => trigger(toJobInput(submitted, job?.id ?? null)))
        if (saved !== undefined) onClose()
    })
    return {
        values,
        isValid: form.formState.isValid,
        isPending: run.isPending,
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
        save: () => void submit(),
    }
}
