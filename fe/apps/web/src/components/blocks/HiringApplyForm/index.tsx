"use client"

import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { CV_ACCEPT, useHiringApply, usePublicHiringJob } from "@/hooks/hiringPublic"
import type { PublicJobView } from "@/hooks/hiringPublic"
import { useHiringApplyForm } from "@/hooks/rhf"
import { HiringApplyFormBase } from "./component"
import type { HiringApplyFormBaseProps } from "./component"

/** The workspace slug and the job slug of the public link. */
interface HiringApplyFormProps {
    readonly ws: string
    readonly job: string
}

type ApplyState = HiringApplyFormBaseProps["props"]["state"]

/** Where the read of the job stands. */
const stateOf = (isMissing: boolean, hasJob: boolean): ApplyState => {
    if (isMissing) return "missing"
    return hasJob ? "ready" : "loading"
}

/** The connected public job page: reads the job without a session, and sends the application (CV first) through the back end GraphQL API. */
export const HiringApplyForm = (props: HiringApplyFormProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const read = usePublicHiringJob(props.ws, props.job)
    const form = useHiringApplyForm()
    const apply = useHiringApply(form, read.view, props)
    const job: PublicJobView | undefined = read.view
    const requirements = job?.requirements
    const doneText =
        apply.done === null
            ? null
            : [
                  t(apply.done.duplicate ? "applyDuplicate" : "applyDone"),
                  apply.done.cvSkipped ? t("applyCvSkipped") : "",
              ]
                  .filter((part) => part !== "")
                  .join(" ")
    const experience =
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
    return (
        <HiringApplyFormBase
            props={{
                say,
                state: stateOf(read.isMissing, job !== undefined),
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
                isFailed: apply.isFailed,
                doneText,
            }}
            on={{
                text: apply.setText,
                flag: apply.setFlag,
                list: apply.setList,
                answer: apply.setAnswer,
                cv: apply.setCv,
                submit: apply.submit,
            }}
        />
    )
}
