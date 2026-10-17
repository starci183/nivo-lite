"use client"

import { useVideoProjectData, editorHref, useVideoActions, useVideoUpload } from "@/hooks/video"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useVideoInputsForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { VideoInputsStepBase } from "./component"

/** A line shown above the step. */
interface InputsMessage {
    readonly tone: "negative" | "informative"
    readonly text: string
}

/** What the page tells the step. */
interface VideoInputsStepProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

const copyOf = (t: ReturnType<typeof useTranslations<"video">>) => ({
    heading: t("inputsHeading"),
    sourcesHeading: t("sourcesHeading"),
    sourcesHint: t("sourcesHint"),
    sourcesEmpty: t("sourcesEmpty"),
    notesLabel: t("notesLabel"),
    notesHint: t("notesHint"),
    mediaHeading: t("mediaHeading"),
    mediaHint: t("mediaHint"),
    mediaEmpty: t("mediaEmpty"),
    uploadLabel: t("upload"),
    backLabel: t("back"),
    nextLabel: t("next"),
})

/** Step two of the wizard: public sources, what to stress, photos and clips. Moving on saves the choices on the video. */
export const VideoInputsStep = (props: VideoInputsStepProps) => {
    const editor = useVideoProjectData(props)
    const t = useTranslations("video")
    const { update } = useVideoActions()
    const { upload: uploadFiles } = useVideoUpload()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const form = useVideoInputsForm(editor.project.inputs)
    const inputs = form.watch()
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState<InputsMessage | null>(null)
    const validation =
        form.formState.errors.notes?.message ??
        form.formState.errors.sourceIds?.message ??
        form.formState.errors.media?.message

    const go = (step: "goal" | "script") =>
        form.handleSubmit(async (values) => {
            setMessage(null)
            const saved = await update(editor.project.id, { inputs: values })
            if (saved === undefined) return
            router.push(`${pathname}${editorHref(editor.project.id, step)}`)
        })()

    const upload = async (files: ReadonlyArray<File>) => {
        setUploading(true)
        setMessage({ tone: "informative", text: t("uploading", { name: files.map((file) => file.name).join(", ") }) })
        try {
            const paths = await uploadFiles(files)
            form.setValue("media", [...form.getValues("media"), ...paths], { shouldDirty: true })
            setMessage(null)
        } finally {
            setUploading(false)
        }
    }

    return (
        <VideoInputsStepBase
            props={{
                ...copyOf(t),
                sources: editor.sources.map((source) => ({
                    value: source.id,
                    label: source.topic === null ? source.title : `${source.topic} - ${source.title}`,
                    excerpt: source.excerpt,
                })),
                sourceIds: inputs.sourceIds,
                notes: inputs.notes,
                media: editor.media.map((item) => ({ ...item, selected: inputs.media.includes(item.path) })),
                canEdit: editor.canEdit,
                busy: uploading || form.formState.isSubmitting,
                message: validation ? { tone: "negative", text: validation } : message,
            }}
            on={{
                sourceIds: (ids) => form.setValue("sourceIds", [...ids], { shouldDirty: true }),
                notes: (value) => form.setValue("notes", value, { shouldDirty: true }),
                toggleMedia: (path) =>
                    form.setValue(
                        "media",
                        inputs.media.includes(path)
                            ? inputs.media.filter((entry) => entry !== path)
                            : [...inputs.media, path],
                        { shouldDirty: true },
                    ),
                upload: (files) => void upload(files),
                back: () => void go("goal"),
                next: () => void go("script"),
            }}
        />
    )
}
