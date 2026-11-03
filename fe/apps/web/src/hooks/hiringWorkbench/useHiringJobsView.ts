"use client"
import { useTranslations } from "next-intl"
import { NEXT_JOB_STATUS, jobStatusTone, useHiringFormat } from "@/hooks/hiring"
import {
    APPLY_CHANNELS,
    EMPLOYMENT_TYPES,
    PAY_UNITS,
    QUESTION_TYPES,
    useHiringJobAd,
    useHiringJobEditor,
    useHiringJobs,
} from "@/hooks/hiringJobs"
import type { HiringWorkbenchData, JobView, AdView } from "@/hooks/hiringWire"
import { useHiringJobForm } from "@/hooks/rhf"
import type { HiringViewInput } from "./hiringWorkbench.shared"

import { useFeatureReset } from "@/hooks/reuseables"
import type { HiringWorkbenchCopy, HiringJobValues, HiringQuestionValues, FieldOf } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"
import type { Dispatch, SetStateAction } from "react"

/** The candidates of each job: all of them, the fresh ones and the hired ones. */
const countsOf = (data: HiringWorkbenchData, jobId: string) => {
    const mine = data.candidates.filter((candidate) => candidate.jobId === jobId)
    return {
        all: mine.length,
        fresh: mine.filter((candidate) => candidate.stage === "applied").length,
        hired: mine.filter((candidate) => candidate.stage === "hired").length,
    }
}

/** What one job row needs besides the job: the workbench data, the formatter, the words and the id whose link was just copied. */
interface JobRowContext {
    readonly data: HiringWorkbenchData
    readonly format: ReturnType<typeof useHiringFormat>
    readonly t: ReturnType<typeof useTranslations<"hiring">>
    readonly copiedId: string | null
}

/** Resolves the job facts and available status transitions. */
const rowOf = (job: JobView, context: JobRowContext) => {
    const { data, format, t, copiedId } = context
    const counts = countsOf(data, job.id)
    const copyKey = copiedId === job.id ? "copiedLink" : "copyLink"
    return {
        id: job.id,
        title: job.title,
        statusLabel: format.label("jobStatus", job.status),
        statusTone: jobStatusTone(job.status),
        facts: [
            format.label("employment", job.employmentType),
            format.pay(job.payMinVnd, job.payMaxVnd, job.payUnit),
            job.location,
            job.schedule,
        ]
            .filter((part) => part !== "")
            .join(" · "),
        counts: t("jobsCounts", { all: counts.all, fresh: counts.fresh, hired: counts.hired, need: job.headcount }),
        publicUrl: job.publicUrl !== null && job.status !== "draft" ? job.publicUrl : null,
        copyLabel: job.publicUrl !== null && job.status === "open" ? t(copyKey) : null,
        transitions: (NEXT_JOB_STATUS[job.status] ?? []).map((to) => ({
            to,
            label: t(`jobAction_${job.status}_${to}`),
            isPrimary: to === "open",
        })),
    }
}
/** The view `useHiringJobsView` returns. */
export interface HiringJobsViewShape {
    props: {
        copy: HiringWorkbenchCopy
        fact: string
        rows: {
            id: string
            title: string
            statusLabel: string
            statusTone: BadgeTone
            facts: string
            counts: string
            publicUrl: string | null
            copyLabel: string | null
            transitions: {
                to: string
                label: string
                isPrimary: boolean
            }[]
        }[]
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
        ad: {
            copy: HiringWorkbenchCopy
            title: string
            ads: AdView | null
            meta: string | null
            publicUrl: string | null
            publicLinkLabel: string | null
            kindLabels: {
                facebook: string
                zalo: string
                topcv: string
            }
            copiedId: string | null
            isBusy: boolean
            error: string | null
        }
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
        rows: data.jobs.map((job) => rowOf(job, { data, format, t, copiedId: jobs.copiedId })),
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
        ad: adDialogOf({ job: jobs.adJob, ad, copy: input.copy, t }),
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

/** What the ad dialog needs: the job it is for, the ad being drafted, the copy words and the translator. */
interface AdDialogInput {
    readonly job: JobView | undefined
    readonly ad: ReturnType<typeof useHiringJobAd>
    readonly copy: HiringViewInput["copy"]
    readonly t: ReturnType<typeof useTranslations<"hiring">>
}

/** The ad dialog keeps all three actual variants and its record-specific title/link labels together. */
const adDialogOf = (input: AdDialogInput) => {
    const { job, ad, t } = input
    const publicUrl = job?.publicUrl ?? null
    return {
        copy: input.copy,
        title: t("adTitle", { title: job?.title ?? "" }),
        ads: ad.ads,
        meta: ad.meta,
        publicUrl: publicUrl,
        publicLinkLabel: publicUrl === null ? null : t("adLink", { url: publicUrl }),
        kindLabels: { facebook: t("adKind_facebook"), zalo: t("adKind_zalo"), topcv: t("adKind_topcv") },
        copiedId: ad.copiedId,
        isBusy: ad.isPending,
        error: ad.error,
    }
}
