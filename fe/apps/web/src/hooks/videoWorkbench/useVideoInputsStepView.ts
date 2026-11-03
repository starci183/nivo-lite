"use client"

import type { VideoEditorActions, VideoEditorViews } from "@/modules/types"
type VideoInputsFormFields = VideoEditorViews["inputs"]
export type VideoInputsFormActions = VideoEditorActions["inputs"]
import type { MediaItem, ProjectInputs } from "@/modules/video"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { useVideoActions, useVideoUpload } from "@/hooks/video"
import { useVideoInputsForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { editorHref } from "@/modules/video"

import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { videoOwnerOf } from "./videoWorkbench.shared"
import type { VideoViewInput } from "./videoWorkbench.shared"
interface InputsProjection {
    readonly input: VideoViewInput
    readonly inputs: ProjectInputs
    readonly busy: boolean
    readonly message: VideoInputsFormFields["message"]
}
/** The existing atomic field edits stay together in their actual form owner. */
const inputsActionsOf = (
    form: ReturnType<typeof useVideoInputsForm>,
    inputs: ProjectInputs,
    upload: (files: ReadonlyArray<File>) => void,
    go: (step: "goal" | "script") => void,
): VideoInputsFormActions => ({
    sourceIds: (ids) => form.setValue("sourceIds", [...ids], { shouldDirty: true }),
    notes: (value) => form.setValue("notes", value, { shouldDirty: true }),
    toggleMedia: (path) =>
        form.setValue(
            "media",
            inputs.media.includes(path) ? inputs.media.filter((e) => e !== path) : [...inputs.media, path],
            { shouldDirty: true },
        ),
    upload,
    back: () => go("goal"),
    next: () => go("script"),
})
/** Resolves the inputs drawing from actual form/read atoms. */
const inputsFieldsOf = (context: InputsProjection) => {
    const { input, inputs, busy, message } = context
    const copy = input.copy
    return {
        ui: {
            heading: copy.inputsHeading,
            sourcesHeading: copy.sourcesHeading,
            sourcesHint: copy.sourcesHint,
            sourcesEmpty: copy.sourcesEmpty,
            sourceIds: inputs.sourceIds,
            notesLabel: copy.notesLabel,
            notesHint: copy.notesHint,
            notes: inputs.notes,
            mediaHeading: copy.mediaHeading,
            mediaHint: copy.mediaHint,
            mediaEmpty: copy.mediaEmpty,
            uploadLabel: copy.upload,
            backLabel: copy.back,
            nextLabel: copy.next,
            busy: busy,
            message: message,
        },
        read:
            input.editor === null
                ? null
                : {
                      sources: input.editor.sources.map((s) => ({
                          value: s.id,
                          label: s.topic === null ? s.title : s.topic + " - " + s.title,
                          excerpt: s.excerpt,
                      })),
                      media: input.editor.media,
                      canEdit: input.editor.canEdit,
                  },
    }
}
type UseVideoInputsStepViewResult = {
    on: VideoInputsFormActions
    mediaPaths: string[]
    ui: {
        heading: string
        sourcesHeading: string
        sourcesHint: string
        sourcesEmpty: string
        sourceIds: readonly string[]
        notesLabel: string
        notesHint: string
        notes: string
        mediaHeading: string
        mediaHint: string
        mediaEmpty: string
        uploadLabel: string
        backLabel: string
        nextLabel: string
        busy: boolean
        message: {
            readonly tone: "negative" | "informative"
            readonly text: string
        } | null
    }
    read: {
        sources: {
            value: string
            label: string
            excerpt: string
        }[]
        media: readonly MediaItem[]
        canEdit: boolean
    } | null
}

/** The selected project's material form, upload and save retain their original commands. */
export const useVideoInputsStepView = (input: VideoViewInput): UseVideoInputsStepViewResult => {
    const t = useTranslations("video"),
        owner = videoOwnerOf(input, "inputs"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        actions = useVideoActions(owner),
        uploader = useVideoUpload(),
        report = useGraphQLWithToast(),
        router = navigation.useRouter(),
        pathname = navigation.usePathname(),
        project = input.editor?.project ?? null
    const form = useVideoInputsForm(project?.inputs ?? null),
        inputs = form.watch(),
        [uploading, setUploading] = useState(false),
        [message, setMessage] = useState<VideoInputsFormFields["message"]>(null)
    useFeatureReset({
        isActive: input.isActive,
        isReady: project !== null,
        scope: owner.scope,
        onReset: () => {
            form.reset(
                project === null
                    ? { sourceIds: [], notes: "", media: [], auto: false }
                    : { ...project.inputs, sourceIds: [...project.inputs.sourceIds], media: [...project.inputs.media] },
            )
            setUploading(false)
            setMessage(null)
        },
    })
    const validation =
        form.formState.errors.notes?.message ??
        form.formState.errors.sourceIds?.message ??
        form.formState.errors.media?.message
    const go = (step: "goal" | "script") => {
        const current = lifetime.capture()
        if (!current() || project === null) return
        form.handleSubmit((values) => {
            if (!current()) return
            setMessage(null)
            actions
                .update(project.id, { inputs: values }, (saved) => {
                    if (saved !== undefined && current()) router.push(pathname + editorHref(project.id, step))
                })
                .catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        })().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
    }
    const upload = (files: ReadonlyArray<File>) => {
        const current = lifetime.capture()
        if (!current()) return
        setUploading(true)
        setMessage({ tone: "informative", text: t("uploading", { name: files.map((f) => f.name).join(", ") }) })
        uploader
            .upload(files)
            .then((paths) => {
                if (!current()) return
                form.setValue("media", [...form.getValues("media"), ...paths], { shouldDirty: true })
                setMessage(null)
            })
            .catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
            .finally(() => {
                if (current()) setUploading(false)
            })
    }
    const fields = inputsFieldsOf({
        input,
        inputs,
        busy: uploading || form.formState.isSubmitting || actions.isPending,
        message: validation ? { tone: "negative", text: validation } : message,
    })
    const on: VideoInputsFormActions = inputsActionsOf(form, inputs, upload, go)
    return { ...fields, on, mediaPaths: inputs.media }
}
