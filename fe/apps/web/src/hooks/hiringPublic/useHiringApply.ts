import { useTranslations } from "next-intl"
import type { FieldOf } from "@/hooks/hiring"
import { useState } from "react"
import type { UseFormReturn } from "react-hook-form"
import { useMutateApplyToHiringJobSwr, useMutateCreateHiringCvUploadSwr } from "@/hooks/swr"
import { putPresigned } from "@/modules/api"
import { useGraphQLWithToast } from "@/modules/toast"
import { CV_MAX_BYTES, NO_PUBLIC_JOB, answerGroups, availabilityOf, cvUploadUrl } from "./hiringPublic.shared"
import type { ApplyValues, PublicJobView } from "./hiringPublic.shared"

/** The workspace slug and the job slug of the public link. */
interface ApplyTarget {
    readonly ws: string
    readonly job: string
}

/** The place a CV went to. */
interface StoredCv {
    readonly path: string
    readonly name: string
}

/** What the page says after a send. */
interface ApplyDone {
    readonly duplicate: boolean
    /** A CV was chosen but could not be attached, so the application went without it. */
    readonly cvSkipped: boolean
}

/** The apply form of a public job: the values, the CV, the checks, and the send (CV upload first, then the application). */
export const useHiringApply = (
    form: UseFormReturn<ApplyValues>,
    read: PublicJobView | undefined,
    target: ApplyTarget,
) => {
    const t = useTranslations("hiring")
    const job = read ?? NO_PUBLIC_JOB
    const runGraphQL = useGraphQLWithToast()
    const { trigger: createUpload } = useMutateCreateHiringCvUploadSwr()
    const { trigger: apply } = useMutateApplyToHiringJobSwr()
    const [cv, setCv] = useState<File | null>(null)
    const [isPending, setPending] = useState(false)
    const [done, setDone] = useState<ApplyDone | null>(null)
    const [isFailed, setFailed] = useState(false)
    const values = form.watch()
    const cvError = cv !== null && cv.size > CV_MAX_BYTES ? t("applyCvTooBig") : undefined
    const store = async (file: File): Promise<StoredCv | null> => {
        const upload = await runGraphQL(() => createUpload({ ws: target.ws, job: target.job, fileName: file.name }), {
            showSuccessToast: false,
            showErrorToast: false,
        })
        if (upload === undefined) return null
        const sent = await putPresigned({ url: cvUploadUrl(upload.path, upload.token), file }).then(
            () => true,
            () => false,
        )
        return sent ? { path: upload.path, name: file.name } : null
    }
    const submit = form.handleSubmit(async (submitted) => {
        setPending(true)
        setFailed(false)
        const stored = cv === null ? null : await store(cv)
        const result = await runGraphQL(
            () =>
                apply({
                    ws: target.ws,
                    job: target.job,
                    name: submitted.name,
                    phone: submitted.phone,
                    email: submitted.email,
                    availability: availabilityOf(submitted, job),
                    answers: answerGroups(submitted, job),
                    consent: submitted.consent,
                    website: submitted.website,
                    cvPath: stored?.path ?? null,
                    cvName: stored?.name ?? null,
                }),
            { showSuccessToast: false },
        )
        setPending(false)
        if (result === undefined) setFailed(true)
        else setDone({ duplicate: result.duplicate, cvSkipped: cv !== null && stored === null })
    })
    return {
        values,
        cvError,
        done,
        isFailed,
        isPending,
        canSubmit:
            values.consent &&
            values.name.trim() !== "" &&
            (values.phone.trim() !== "" || values.email.trim() !== "") &&
            cvError === undefined,
        setText: (name: FieldOf<ApplyValues, string>, value: string) =>
            form.setValue(name, value, { shouldValidate: true }),
        setFlag: (name: FieldOf<ApplyValues, boolean>, value: boolean) =>
            form.setValue(name, value, { shouldValidate: true }),
        setList: (name: FieldOf<ApplyValues, Array<string>>, value: Array<string>) =>
            form.setValue(name, value, { shouldValidate: true }),
        setAnswer: (id: string, answer: string) => form.setValue("answers", { ...values.answers, [id]: answer }),
        setCv,
        submit: () => void submit(),
    }
}
