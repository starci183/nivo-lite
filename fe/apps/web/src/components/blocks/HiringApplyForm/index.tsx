"use client"

import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { CV_ACCEPT, useHiringApply, usePublicHiringJob } from "@/hooks/hiringPublic"
import type { PublicJobView } from "@/hooks/hiringPublic"
import { useHiringApplyForm } from "@/hooks/rhf"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { HiringApplyFormBase } from "./component"

/** The workspace slug and the job slug of the public link. */
interface HiringApplyFormProps {
    readonly ws: string
    readonly job: string
}

type HiringTranslator = ReturnType<typeof useTranslations<"hiring">>

/** What the candidate reads once the application is in; null while none was sent. */
const doneTextOf = (t: HiringTranslator, done: ReturnType<typeof useHiringApply>["done"]): string | null =>
    done === null
        ? null
        : [t(done.duplicate ? "applyDuplicate" : "applyDone"), done.cvSkipped ? t("applyCvSkipped") : ""]
              .filter((part) => part !== "")
              .join(" ")

/** The experience line of the job post; null when the job asks for none. */
const experienceTextOf = (
    t: HiringTranslator,
    requirements: PublicJobView["requirements"] | undefined,
): string | null =>
    requirements === undefined || (requirements.experienceYears === null && requirements.experienceNote === "")
        ? null
        : [
              requirements.experienceYears === null
                  ? ""
                  : t("applyExperienceYears", { n: requirements.experienceYears }),
              requirements.experienceNote,
          ]
              .filter((part) => part !== "")
              .join(" ")

/** The connected public job page: reads the job without a session, and sends the application (CV first) through the back end GraphQL API. */
export const HiringApplyForm = (props: HiringApplyFormProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const slotLabels = useSlotLabels()
    const read = usePublicHiringJob(props.ws, props.job)
    const form = useHiringApplyForm()
    const apply = useHiringApply(form, read.view, props)
    const job: PublicJobView | undefined = read.view
    const requirements = job?.requirements
    const doneText = doneTextOf(t, apply.done)
    const experience = experienceTextOf(t, requirements)
    return (
        <HiringApplyFormBase
            props={{
                say,
                slot: slotOfSwr({
                    data: job === undefined ? undefined : (true as const),
                    error: read.isMissing ? say("applyMissing") : undefined,
                    isLoading: read.isLoading,
                }),
                slotLabels: { ...slotLabels(say("applyMissing")), error: say("applyMissing") },
                post: {
                    company: job?.company ?? "",
                    title: job?.title ?? "",
                    facts: [
                        format.label("employment", job?.employmentType ?? ""),
                        format.pay(job?.payMinVnd ?? null, job?.payMaxVnd ?? null, job?.payUnit ?? ""),
                        job?.location ?? "",
                        job?.schedule ?? "",
                    ].filter((fact) => fact !== ""),
                    cardLabel: t("applyAbout"),
                    description: job?.description ?? "",
                    experience: experience === null ? null : t("applyExperience", { text: experience }),
                    lists: [
                        { title: t("applySkills"), items: requirements?.skills ?? [] },
                        { title: t("applySchedule"), items: requirements?.availability ?? [] },
                        { title: t("applyMustHave"), items: requirements?.mustHave ?? [] },
                        { title: t("applyNiceToHave"), items: requirements?.niceToHave ?? [] },
                    ],
                },
                company: job?.company ?? "",
                isOpen: job?.open ?? false,
                consentText: job?.consentText ?? "",
                questions: job?.questions ?? [],
                availabilityChoices: requirements?.availability ?? [],
                values: apply.values,
                cvAccept: CV_ACCEPT,
                cvError: apply.cvError,
                canSubmit: apply.canSubmit,
                isBusy: apply.isPending,
                submitError: apply.isFailed ? say("applyFailed") : null,
                doneText,
            }}
            on={{
                text: apply.setText,
                flag: apply.setFlag,
                list: apply.setList,
                answer: apply.setAnswer,
                cv: apply.setCv,
                submit: apply.submit,
                retry: read.reload,
            }}
        />
    )
}
