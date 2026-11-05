"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { CV_ACCEPT, useHiringApply, usePublicHiringJob } from "@/hooks/hiringPublic"
import type { PublicJobView } from "@/hooks/hiringPublic"
import type { ApplyValues, HiringSay } from "@/modules/types"
import { useLocaleSwitch } from "@/hooks/locale"
import { useHiringApplyForm } from "@/hooks/rhf"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { HiringApplyFormBase } from "./component"
import type { HiringApplyDone } from "./component"

/** The workspace slug and the job slug of the public link. */
interface HiringApplyFormProps {
    readonly ws: string
    readonly job: string
}

type HiringTranslator = ReturnType<typeof useTranslations<"hiring">>

/** What the candidate reads once the application is in; null while none was sent. A repeat is a plain notice, a first send a confirmation. */
const doneOf = (t: HiringTranslator, done: ReturnType<typeof useHiringApply>["done"]): HiringApplyDone | null =>
    done === null
        ? null
        : {
              tone: done.duplicate ? "informative" : "affirmative",
              title: t(done.duplicate ? "applyDuplicateTitle" : "applyDoneTitle"),
              body: [
                  t(done.duplicate ? "applyDuplicateBody" : "applyDoneBody"),
                  done.cvSkipped ? t("applyCvSkipped") : "",
              ]
                  .filter((part) => part !== "")
                  .join(" "),
          }

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

/** What a send still lacks, in the order the form asks for it: the name, a way to reach the candidate, the CV, the consent. */
const missingTextOf = (say: HiringSay, values: ApplyValues, cvError: string | undefined): string => {
    if (values.name.trim() === "") return say("applyNeedName")
    if (values.phone.trim() === "" && values.email.trim() === "") return say("applyNeedContact")
    if (cvError !== undefined) return cvError
    return say("applyNeedConsent")
}

/** The connected public job page: reads the job without a session, and sends the application (CV first) through the back end GraphQL API. */
export const HiringApplyForm = (props: HiringApplyFormProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const slotLabels = useSlotLabels()
    const language = useLocaleSwitch()
    const [attempted, setAttempted] = useState(false)
    const read = usePublicHiringJob(props.ws, props.job)
    const form = useHiringApplyForm()
    const apply = useHiringApply(form, read.view, props)
    const job: PublicJobView | undefined = read.view
    const requirements = job?.requirements
    const done = doneOf(t, apply.done)
    const experience = experienceTextOf(t, requirements)
    return (
        <HiringApplyFormBase
            props={{
                say,
                slot: read.isMissing
                    ? { isEmpty: true }
                    : slotOfSwr({
                          data: job === undefined ? undefined : (true as const),
                          error: read.isFailed ? true : undefined,
                          isLoading: read.isLoading,
                      }),
                slotLabels: { ...slotLabels(say("applyMissing")), error: say("applyLoadFailed") },
                failedBody: say("applyLoadFailedBody"),
                language: { ...language },
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
                consentText: job?.consentText ?? say("applyConsentDefault", { company: job?.company ?? "" }),
                questions: job?.questions ?? [],
                availabilityChoices: requirements?.availability ?? [],
                values: apply.values,
                cvAccept: CV_ACCEPT,
                cvError: apply.cvError,
                missing: attempted && !apply.canSubmit ? missingTextOf(say, apply.values, apply.cvError) : null,
                isBusy: apply.isPending,
                submitError: apply.isFailed ? say("applyFailed") : null,
                done,
            }}
            on={{
                text: apply.setText,
                flag: apply.setFlag,
                list: apply.setList,
                answer: apply.setAnswer,
                cv: apply.setCv,
                submit: () => {
                    setAttempted(true)
                    if (apply.canSubmit) apply.submit()
                },
                retry: read.reload,
                chooseLanguage: language.choose,
            }}
        />
    )
}
