"use client"
import { useTranslations } from "next-intl"
import { useHiringFormat } from "@/hooks/hiring"
import {
    APPLY_CHANNELS,
    EMPLOYMENT_TYPES,
    PAY_UNITS,
    QUESTION_TYPES,
    useHiringJobAd,
    useHiringJobEditor,
    useHiringJobs,
} from "@/hooks/hiringJobs"
import { useHiringJobForm } from "@/hooks/rhf"
import { jobAdDialogOf, jobRowOf, type HiringViewInput } from "./hiringWorkbench.shared"

import { useFeatureReset } from "@/hooks/reuseables"
import type { HiringWorkbenchCopy, HiringJobValues, HiringQuestionValues, FieldOf } from "@/modules/types"
import type { Dispatch, SetStateAction } from "react"

/** The view `useHiringJobsView` returns. */
export interface HiringJobsViewShape {
    props: {
        copy: HiringWorkbenchCopy
        fact: string
        rows: ReturnType<typeof jobRowOf>[]
        isBusy: boolean
        error: string | null
        isEditorOpen: boolean
        editor: {
            copy: HiringWorkbenchCopy
            isNew: boolean
            values: HiringJobValues
            questions: {
                question: HiringQuestionValues
                numberLabel: string
            }[]
            employmentOptions: {
                id: string
                label: string
            }[]
            payUnitOptions: {
                id: string
                label: string
            }[]
            questionTypeOptions: {
                id: string
                label: string
            }[]
            channelOptions: {
                id: string
                label: string
            }[]
            canSave: boolean
            canAddQuestion: boolean
            isBusy: boolean
            error: string | null
        }
        isAdOpen: boolean
        ad: ReturnType<typeof jobAdDialogOf>
    }
    on: {
        list: {
            create: () => void
            edit: (id: string) => void
            openAd: Dispatch<SetStateAction<string | null>>
            copy: (id: string) => void
            transition: (id: string, to: string) => void
        }
        editor: {
            text: (name: FieldOf<HiringJobValues, string>, value: string) => void
            number: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
            list: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) => void
            patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) => void
            addQuestion: () => void
            removeQuestion: (index: number) => void
            save: () => void
            close: () => void
        }
        ad: {
            generate: () => void
            copy: (id: string, text: string) => void
            close: () => void
        }
    }
}

/** Owns HiringJobs's resolved data, commands and actual panel activation. */
export const useHiringJobsView = (input: HiringViewInput): HiringJobsViewShape => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const t = useTranslations("hiring")
    const format = useHiringFormat()
    const data = input.board
    const jobs = useHiringJobs(data, owner)
    const form = useHiringJobForm(jobs.editorJob)
    const closeEditor = () => {
        form.reset()
        jobs.closeEditor()
    }
    const editor = useHiringJobEditor(form, jobs.editorJob, closeEditor, owner)
    const ad = useHiringJobAd(jobs.adJob, owner)

    useFeatureReset({
        isActive: input.isActive,
        isReady: input.isReady,
        scope: input.scope,
        onReset: () => form.reset(),
    })

    const props = {
        copy: input.copy,
        fact: t("jobsFact", { n: data.jobs.length }),
        rows: data.jobs.map((job) => jobRowOf(job, { data, format, t, copiedId: jobs.copiedId })),
        isBusy: jobs.isPending,
        error: jobs.error,
        isEditorOpen: jobs.editing !== null,
        editor: {
            copy: input.copy,
            isNew: jobs.editorJob === null,
            values: editor.values,
            questions: editor.values.questions.map((question, index) => ({
                question,
                numberLabel: t("qNumber", { n: index + 1 }),
            })),
            employmentOptions: EMPLOYMENT_TYPES.map((type) => ({ id: type, label: t(`employment_${type}`) })),
            payUnitOptions: PAY_UNITS.map((unit) => ({ id: unit, label: t(`payUnit_${unit}`) })),
            questionTypeOptions: QUESTION_TYPES.map((type) => ({ id: type, label: t(`qType_${type}`) })),
            channelOptions: APPLY_CHANNELS.map((channel) => ({ id: channel, label: t(`channel_${channel}`) })),
            canSave: editor.isValid,
            canAddQuestion: editor.canAddQuestion,
            isBusy: editor.isPending,
            error: editor.error,
        },
        isAdOpen: jobs.adJob !== undefined,
        ad: jobAdDialogOf({ job: jobs.adJob, ad, copy: input.copy, t }),
    }
    const on = {
        list: {
            create: jobs.create,
            edit: jobs.edit,
            openAd: jobs.openAd,
            copy: jobs.copyLink,
            transition: jobs.transition,
        },
        editor: {
            text: editor.setText,
            number: editor.setNumber,
            list: editor.setList,
            patchQuestion: editor.patchQuestion,
            addQuestion: editor.addQuestion,
            removeQuestion: editor.removeQuestion,
            save: editor.save,
            close: closeEditor,
        },
        ad: { generate: ad.generate, copy: ad.copy, close: jobs.closeAd },
    }
    return { props, on }
}
