"use client"

import { useVideoBrandKitData, MUSIC_TRACKS, TTS_VOICES, useVideoRelease, useVideoUpload } from "@/hooks/video"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useVideoBrandForm } from "@/hooks/rhf"
import { VideoBrandCardBase } from "./component"

/** The option that means no music. */
const NO_MUSIC = "none"

/** A line shown under the brand form. */
interface BrandMessage {
    readonly tone: "affirmative" | "negative"
    readonly text: string
}

/** The brand kit of the workspace, used by every video: name, colours, logo, music and voice. */
export const VideoBrandCard = () => {
    const kit = useVideoBrandKitData()
    const t = useTranslations("video")
    const { saveBrand } = useVideoRelease()
    const { upload } = useVideoUpload()
    const form = useVideoBrandForm(kit.brand)
    const draft = form.watch()
    const [uploading, setUploading] = useState(false)
    const [message, setMessage] = useState<BrandMessage | null>(null)
    const logoPath = draft.logoPath
    const logo = logoPath === null ? null : kit.media.find((item) => item.path === logoPath)

    const pickLogo = async (files: ReadonlyArray<File>) => {
        const file = files[0]
        if (file === undefined) return
        setUploading(true)
        setMessage(null)
        try {
            const [path] = await upload([file])
            if (path !== undefined) form.setValue("logoPath", path, { shouldDirty: true })
        } finally {
            setUploading(false)
        }
    }

    const save = form.handleSubmit(async (values) => {
        setMessage(null)
        const saved = await saveBrand(values)
        if (saved !== undefined) {
            form.reset({ ...saved, logoPath: saved.logoPath ?? null, musicTrack: saved.musicTrack ?? null })
            setMessage({ tone: "affirmative", text: t("brandSaved") })
        }
    })

    return (
        <VideoBrandCardBase
            props={{
                title: t("brandTitle"),
                hint: t("brandHint"),
                shopNameLabel: t("shopName"),
                shopName: draft.shopName,
                primaryLabel: t("primary"),
                primary: draft.primary,
                secondaryLabel: t("secondary"),
                secondary: draft.secondary,
                colorHint: t("colorHint"),
                logoLabel: t("logo"),
                logoUrl: logo?.url ?? null,
                logoNone: t("logoNone"),
                logoUpload: t("logoUpload"),
                logoRemove: t("logoRemove"),
                hasLogo: logoPath !== null,
                musicLabel: t("music"),
                music: draft.musicTrack ?? NO_MUSIC,
                musics: [
                    { id: NO_MUSIC, label: t("musicNone") },
                    ...MUSIC_TRACKS.map((track) => ({ id: track.id, label: t(`music_${track.id}`) })),
                ],
                voiceLabel: t("voice"),
                voice: draft.voice,
                voices: TTS_VOICES.map((voice) => ({
                    id: voice,
                    label: t(voice.includes("Hoai") ? "voice_f" : "voice_m"),
                })),
                saveLabel: t("saveBrand"),
                canEdit: kit.canEdit,
                pending: uploading || form.formState.isSubmitting,
                message: Object.values(form.formState.errors)[0]?.message
                    ? { tone: "negative", text: Object.values(form.formState.errors)[0]?.message ?? t("err_default") }
                    : message,
            }}
            on={{
                shopName: (value) => form.setValue("shopName", value, { shouldDirty: true }),
                primary: (value) => form.setValue("primary", value, { shouldDirty: true }),
                secondary: (value) => form.setValue("secondary", value, { shouldDirty: true }),
                logoFiles: (files) => void pickLogo(files),
                logoRemove: () => form.setValue("logoPath", null, { shouldDirty: true }),
                music: (value) =>
                    form.setValue("musicTrack", value === null || value === NO_MUSIC ? null : value, {
                        shouldDirty: true,
                    }),
                voice: (value) => form.setValue("voice", value ?? draft.voice, { shouldDirty: true }),
                save: () => void save(),
            }}
        />
    )
}
