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

const copyOf = (t: ReturnType<typeof useTranslations<"video">>) => ({
    title: t("brandTitle"),
    hint: t("brandHint"),
    shopNameLabel: t("shopName"),
    primaryLabel: t("primary"),
    secondaryLabel: t("secondary"),
    colorHint: t("colorHint"),
    logoLabel: t("logo"),
    logoNone: t("logoNone"),
    logoUpload: t("logoUpload"),
    logoRemove: t("logoRemove"),
    musicLabel: t("music"),
    voiceLabel: t("voice"),
    saveLabel: t("saveBrand"),
})

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
                ...copyOf(t),
                shopName: draft.shopName,
                primary: draft.primary,
                secondary: draft.secondary,
                logoUrl: logo?.url ?? null,
                hasLogo: logoPath !== null,
                music: draft.musicTrack ?? NO_MUSIC,
                musics: [
                    { id: NO_MUSIC, label: t("musicNone") },
                    ...MUSIC_TRACKS.map((track) => ({ id: track.id, label: t(`music_${track.id}`) })),
                ],
                voice: draft.voice,
                voices: TTS_VOICES.map((voice) => ({
                    id: voice,
                    label: t(voice.includes("Hoai") ? "voice_f" : "voice_m"),
                })),
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
