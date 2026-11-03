"use client"

import type { VideoLibraryActions, VideoLibraryViews } from "@/modules/types"
type VideoBrandSettingsFields = VideoLibraryViews["brand"]
export type VideoBrandSettingsActions = VideoLibraryActions["brand"]
import type { Brand, MediaItem } from "@/modules/video"
import { useState } from "react"
import { useTranslations } from "next-intl"
import { useVideoRelease, useVideoUpload } from "@/hooks/video"
import { useVideoBrandForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { MUSIC_TRACKS, TTS_VOICES } from "@/modules/video"

import { useGraphQLWithToast } from "@/modules/toast"
import { videoOwnerOf } from "./videoWorkbench.shared"
import type { VideoViewInput } from "./videoWorkbench.shared"
interface BrandProjection {
    readonly input: VideoViewInput
    readonly t: ReturnType<typeof useTranslations<"video">>
    readonly draft: Brand
    readonly logo: MediaItem | null | undefined
    readonly logoPath: string | null
    readonly kit: VideoViewInput["editor"] | VideoViewInput["library"]
    readonly pending: boolean
    readonly message: VideoBrandSettingsFields["message"]
}
/** The existing atomic field edits stay together in their actual form owner. */
const brandActionsOf = (
    form: ReturnType<typeof useVideoBrandForm>,
    draft: Brand,
    pickLogo: (files: ReadonlyArray<File>) => void,
    save: () => void,
): VideoBrandSettingsActions => ({
    shopName: (value) => form.setValue("shopName", value, { shouldDirty: true }),
    primary: (value) => form.setValue("primary", value, { shouldDirty: true }),
    secondary: (value) => form.setValue("secondary", value, { shouldDirty: true }),
    logoFiles: pickLogo,
    logoRemove: () => form.setValue("logoPath", null, { shouldDirty: true }),
    music: (value) =>
        form.setValue("musicTrack", value === null || value === "none" ? null : value, { shouldDirty: true }),
    voice: (value) => form.setValue("voice", value ?? draft.voice, { shouldDirty: true }),
    save,
})
/** Resolves the brand drawing from actual form/read atoms. */
const brandFieldsOf = (context: BrandProjection) => {
    const { input, t, draft, logo, logoPath, kit, pending, message } = context
    const copy = input.copy
    return {
        ui: {
            title: copy.brandTitle,
            hint: copy.brandHint,
            shopNameLabel: copy.shopName,
            shopName: draft.shopName,
            primaryLabel: copy.primary,
            primary: draft.primary,
            secondaryLabel: copy.secondary,
            secondary: draft.secondary,
            colorHint: copy.colorHint,
            logoLabel: copy.logo,
            logoNone: copy.logoNone,
            logoUpload: copy.logoUpload,
            logoRemove: copy.logoRemove,
            hasLogo: logoPath !== null,
            musicLabel: copy.music,
            music: draft.musicTrack ?? "none",
            musics: [
                { id: "none", label: copy.musicNone },
                ...MUSIC_TRACKS.map((track) => ({ id: track.id, label: t(`music_${track.id}`) })),
            ],
            voiceLabel: copy.voice,
            voice: draft.voice,
            voices: TTS_VOICES.map((voice) => ({
                id: voice,
                label: t(voice.includes("Hoai") ? "voice_f" : "voice_m"),
            })),
            saveLabel: copy.saveBrand,
            pending: pending,
            message: message,
        },
        read: kit === null ? null : { logoUrl: logo?.url ?? null, canEdit: kit.canEdit },
    }
}
type UseVideoBrandCardViewResult = {
    on: VideoBrandSettingsActions
    ui: {
        title: string
        hint: string
        shopNameLabel: string
        shopName: string
        primaryLabel: string
        primary: string
        secondaryLabel: string
        secondary: string
        colorHint: string
        logoLabel: string
        logoNone: string
        logoUpload: string
        logoRemove: string
        hasLogo: boolean
        musicLabel: string
        music: string
        musics: {
            id: string
            label: string
        }[]
        voiceLabel: string
        voice: string
        voices: {
            id: "vi-VN-HoaiMyNeural" | "vi-VN-NamMinhNeural"
            label: string
        }[]
        saveLabel: string
        pending: boolean
        message: {
            readonly tone: "affirmative" | "negative"
            readonly text: string
        } | null
    }
    read: {
        logoUrl: string | null
        canEdit: boolean
    } | null
}

/** The same brand form participates in either the inputs step or its normal brand tab. */
export const useVideoBrandCardView = (input: VideoViewInput): UseVideoBrandCardViewResult => {
    const t = useTranslations("video"),
        owner = videoOwnerOf(input, "brand"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        actions = useVideoRelease(owner),
        uploader = useVideoUpload(),
        report = useGraphQLWithToast(),
        kit = input.editor ?? input.library
    const form = useVideoBrandForm(kit?.brand ?? null),
        draft = form.watch(),
        [uploading, setUploading] = useState(false),
        [message, setMessage] = useState<VideoBrandSettingsFields["message"]>(null),
        copy = input.copy
    useFeatureReset({
        isActive: input.isActive,
        isReady: kit !== null,
        scope: owner.scope,
        onReset: () => {
            form.reset(
                kit?.brand ?? { shopName: "", primary: "", secondary: "", logoPath: null, musicTrack: null, voice: "" },
            )
            setUploading(false)
            setMessage(null)
        },
    })
    const logoPath = draft.logoPath,
        logo = logoPath === null ? null : kit?.media.find((item) => item.path === logoPath)
    const pickLogo = (files: ReadonlyArray<File>) => {
        const current = lifetime.capture(),
            file = files[0]
        if (!current() || file === undefined) return
        setUploading(true)
        setMessage(null)
        uploader
            .upload([file])
            .then(([path]) => {
                if (path !== undefined && current()) form.setValue("logoPath", path, { shouldDirty: true })
            })
            .catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
            .finally(() => {
                if (current()) setUploading(false)
            })
    }
    const save = () => {
        const current = lifetime.capture()
        if (!current() || kit === null) return
        form.handleSubmit((values) => {
            if (!current()) return
            setMessage(null)
            actions
                .saveBrand(values, (saved) => {
                    if (saved !== undefined && current()) {
                        form.reset({ ...saved, logoPath: saved.logoPath ?? null, musicTrack: saved.musicTrack ?? null })
                        setMessage({ tone: "affirmative", text: copy.brandSaved })
                    }
                })
                .catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        })().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
    }
    const error = Object.values(form.formState.errors)[0]?.message
    const fields = brandFieldsOf({
        input,
        t,
        draft,
        logo,
        logoPath,
        kit,
        pending: uploading || form.formState.isSubmitting || actions.isPending,
        message: error ? { tone: "negative", text: error } : message,
    })
    const on: VideoBrandSettingsActions = brandActionsOf(form, draft, pickLogo, save)
    return { ...fields, on }
}
