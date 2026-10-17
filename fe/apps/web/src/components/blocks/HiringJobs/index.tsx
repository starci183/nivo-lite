"use client"

import { useTranslations } from "next-intl"
import { NEXT_JOB_STATUS, jobStatusTone, useHiringFormat, useHiringSay, useHiringWorkbench } from "@/hooks/hiring"
import {
    APPLY_CHANNELS,
    EMPLOYMENT_TYPES,
    PAY_UNITS,
    QUESTION_TYPES,
    useHiringJobAd,
    useHiringJobEditor,
    useHiringJobs,
} from "@/hooks/hiringJobs"
import type { HiringWorkbenchData, JobView } from "@/hooks/hiringWire"
import { useHiringJobForm } from "@/hooks/rhf"
import { HiringJobsBase } from "./component"

/** The candidates of each job: all of them, the fresh ones and the hired ones. */
const countsOf = (data: HiringWorkbenchData, jobId: string) => {
    const mine = data.candidates.filter((candidate) => candidate.jobId === jobId)
    return {
        all: mine.length,
        fresh: mine.filter((candidate) => candidate.stage === "applied").length,
        hired: mine.filter((candidate) => candidate.stage === "hired").length,
    }
}

/** The connected jobs tab: lists the job posts, runs their status commands, and holds the editor and the ad dialogs. */
export const HiringJobs = () => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const { board: data } = useHiringWorkbench()
    const jobs = useHiringJobs(data)
    const form = useHiringJobForm(jobs.editorJob)
    const closeEditor = () => {
        form.reset()
        jobs.closeEditor()
    }
    const editor = useHiringJobEditor(form, jobs.editorJob, closeEditor)
    const ad = useHiringJobAd(jobs.adJob)
    return (
        <HiringJobsBase
            props={{
                say,
                fact: t("jobsFact", { n: data.jobs.length }),
                rows: data.jobs.map((job) => rowOf(job, data, format, t, jobs.copiedId)),
                isBusy: jobs.isPending,
                error: jobs.error,
                isEditorOpen: jobs.editing !== null,
                editor: {
                    say,
                    isNew: jobs.editorJob === null,
                    values: editor.values,
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
                ad: {
                    say,
                    title: t("adTitle", { title: jobs.adJob?.title ?? "" }),
                    ads: ad.ads,
                    meta: ad.meta,
                    publicUrl: jobs.adJob?.publicUrl ?? null,
                    copiedId: ad.copiedId,
                    isBusy: ad.isPending,
                    error: ad.error,
                },
            }}
            on={{
                create: jobs.create,
                edit: jobs.edit,
                openAd: jobs.openAd,
                copy: jobs.copyLink,
                transition: jobs.transition,
                editorText: editor.setText,
                editorNumber: editor.setNumber,
                editorList: editor.setList,
                patchQuestion: editor.patchQuestion,
                addQuestion: editor.addQuestion,
                removeQuestion: editor.removeQuestion,
                saveEditor: editor.save,
                closeEditor,
                generateAd: ad.generate,
                copyAd: ad.copy,
                closeAd: jobs.closeAd,
            }}
        />
    )
}

/** Resolves the job facts and available status transitions. */
const rowOf = (
    job: JobView,
    data: HiringWorkbenchData,
    format: ReturnType<typeof useHiringFormat>,
    t: ReturnType<typeof useTranslations<"hiring">>,
    copiedId: string | null,
) => {
    const counts = countsOf(data, job.id)
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
        copyLabel:
            job.publicUrl !== null && job.status === "open" ? t(copiedId === job.id ? "copiedLink" : "copyLink") : null,
        transitions: (NEXT_JOB_STATUS[job.status] ?? []).map((to) => ({
            to,
            label: t(`jobAction_${job.status}_${to}`),
            isPrimary: to === "open",
        })),
    }
}
