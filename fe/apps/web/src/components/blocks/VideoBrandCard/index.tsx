"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { MUSIC_TRACKS, TTS_VOICES, uploadMediaFiles, useVideoFailure } from "@/hooks/video"
import type { Brand, MediaItem } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { saveVideoBrand } from "@/modules/db/video/write-brand"
import { writeMediaTicket } from "@/modules/db/video/write-media"
import { VideoBrandCardBase } from "./component"

/** The option that means no music. */
const NO_MUSIC = "none"

/** A line shown under the brand form. */
interface BrandMessage {
    readonly tone: "affirmative" | "negative"
    readonly text: string
}

interface VideoBrandCardProps {
    readonly brand: Brand
    readonly media: ReadonlyArray<MediaItem>
    readonly canEdit: boolean
}

/** The brand kit of the workspace, used by every video: name, colours, logo, music and voice. */
export const VideoBrandCard = (props: VideoBrandCardProps) => {
    const t = useTranslations("video")
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const [draft, setDraft] = useState<Brand>(props.brand)
    const [pending, setPending] = useState(false)
    const [message, setMessage] = useState<BrandMessage | null>(null)
    const logoPath = draft.logoPath
    const logo = logoPath === null ? null : props.media.find((item) => item.path === logoPath)

    const pickLogo = async (files: ReadonlyArray<File>) => {
        const file = files[0]
        if (file === undefined) return
        setPending(true)
        setMessage(null)
        const sent = await uploadMediaFiles([file], async (entry) => {
            const ticket = await writeMediaTicket({ name: entry.name, type: entry.type, size: entry.size })
            return ticket.kind === "ok" ? { ticket: ticket.value } : { code: ticket.code }
        })
        const failed = sent.failures[0]
        const path = sent.paths[0]
        if (failed !== undefined) {
            setMessage({
                tone: "negative",
                text: t("uploadFailed", { name: failed.name, error: failure(failed.code) }),
            })
        } else if (path !== undefined) {
            setDraft({ ...draft, logoPath: path })
            router.refresh()
        }
        setPending(false)
    }

    const save = async () => {
        setPending(true)
        setMessage(null)
        const saved = await saveVideoBrand(draft)
        if (saved.kind === "ok") {
            setDraft(saved.value)
            setMessage({ tone: "affirmative", text: t("brandSaved") })
        } else {
            setMessage({ tone: "negative", text: t("actionFailed", { error: failure(saved.code) }) })
        }
        setPending(false)
    }

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
                canEdit: props.canEdit,
                pending,
                message,
            }}
            on={{
                shopName: (value) => setDraft({ ...draft, shopName: value }),
                primary: (value) => setDraft({ ...draft, primary: value }),
                secondary: (value) => setDraft({ ...draft, secondary: value }),
                logoFiles: (files) => void pickLogo(files),
                logoRemove: () => setDraft({ ...draft, logoPath: null }),
                music: (value) =>
                    setDraft({ ...draft, musicTrack: value === null || value === NO_MUSIC ? null : value }),
                voice: (value) => setDraft({ ...draft, voice: value ?? draft.voice }),
                save: () => void save(),
            }}
        />
    )
}
