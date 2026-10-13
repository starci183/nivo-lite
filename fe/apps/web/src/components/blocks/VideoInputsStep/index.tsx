"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { editorHref, uploadMediaFiles, useVideoFailure } from "@/hooks/video"
import type { MediaItem, ProjectInputs, ProjectView, SourceChoice } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { writeMediaTicket } from "@/modules/db/video/write-media"
import { updateVideoProject } from "@/modules/db/video/write-project"
import { VideoInputsStepBase } from "./component"

/** A line shown above the step. */
interface InputsMessage {
    readonly tone: "negative" | "informative"
    readonly text: string
}

interface VideoInputsStepProps {
    readonly project: ProjectView
    readonly sources: ReadonlyArray<SourceChoice>
    readonly media: ReadonlyArray<MediaItem>
    readonly canEdit: boolean
}

/** Step two of the wizard: public sources, what to stress, photos and clips. Moving on saves the choices on the video. */
export const VideoInputsStep = (props: VideoInputsStepProps) => {
    const t = useTranslations("video")
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const [inputs, setInputs] = useState<ProjectInputs>(props.project.inputs)
    const [pending, setPending] = useState(false)
    const [message, setMessage] = useState<InputsMessage | null>(null)

    const go = async (step: "goal" | "script") => {
        setPending(true)
        setMessage(null)
        const saved = await updateVideoProject(props.project.id, { inputs })
        if (saved.kind !== "ok") {
            setMessage({ tone: "negative", text: t("actionFailed", { error: failure(saved.code) }) })
            setPending(false)
            return
        }
        router.push(`${pathname}${editorHref(props.project.id, step)}`)
    }

    const upload = async (files: ReadonlyArray<File>) => {
        setPending(true)
        setMessage({ tone: "informative", text: t("uploading", { name: files.map((file) => file.name).join(", ") }) })
        const sent = await uploadMediaFiles(files, async (file) => {
            const ticket = await writeMediaTicket({ name: file.name, type: file.type, size: file.size })
            return ticket.kind === "ok" ? { ticket: ticket.value } : { code: ticket.code }
        })
        const failed = sent.failures.map((entry) => t("uploadFailed", { name: entry.name, error: failure(entry.code) }))
        setMessage(failed.length > 0 ? { tone: "negative", text: failed.join(" ") } : null)
        router.refresh()
        setInputs({ ...inputs, media: [...inputs.media, ...sent.paths] })
        setPending(false)
    }

    return (
        <VideoInputsStepBase
            props={{
                heading: t("inputsHeading"),
                sourcesHeading: t("sourcesHeading"),
                sourcesHint: t("sourcesHint"),
                sourcesEmpty: t("sourcesEmpty"),
                sources: props.sources.map((source) => ({
                    value: source.id,
                    label: source.topic === null ? source.title : `${source.topic} - ${source.title}`,
                    excerpt: source.excerpt,
                })),
                sourceIds: inputs.sourceIds,
                notesLabel: t("notesLabel"),
                notesHint: t("notesHint"),
                notes: inputs.notes,
                mediaHeading: t("mediaHeading"),
                mediaHint: t("mediaHint"),
                mediaEmpty: t("mediaEmpty"),
                media: props.media.map((item) => ({ ...item, selected: inputs.media.includes(item.path) })),
                uploadLabel: t("upload"),
                backLabel: t("back"),
                nextLabel: t("next"),
                canEdit: props.canEdit,
                busy: pending,
                message,
            }}
            on={{
                sourceIds: (ids) => setInputs({ ...inputs, sourceIds: ids }),
                notes: (value) => setInputs({ ...inputs, notes: value }),
                toggleMedia: (path) =>
                    setInputs({
                        ...inputs,
                        media: inputs.media.includes(path)
                            ? inputs.media.filter((entry) => entry !== path)
                            : [...inputs.media, path],
                    }),
                upload: (files) => void upload(files),
                back: () => void go("goal"),
                next: () => void go("script"),
            }}
        />
    )
}
