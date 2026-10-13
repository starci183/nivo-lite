"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useContentCommand, type ContentSettings } from "@/hooks/content"
import { writeSaveBrand } from "@/modules/db/content-settings/write-settings"
import { ContentBrandCardBase } from "./component"

/** Props of {@link ContentBrandCard}. */
export interface ContentBrandCardProps {
    /** The saved settings. */
    readonly settings: ContentSettings
    /** Whether the member may change them. */
    readonly canManage: boolean
}

/** The brand voice of the posts: tone, words to avoid, call to action and brand hashtags. */
export const ContentBrandCard = (props: ContentBrandCardProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const [voice, setVoice] = useState(props.settings.brand_voice)
    const [avoid, setAvoid] = useState(props.settings.avoid)
    const [cta, setCta] = useState(props.settings.cta)
    const [tags, setTags] = useState(props.settings.hashtags.join(" "))
    return (
        <ContentBrandCardBase
            props={{
                t,
                voice,
                avoid,
                cta,
                tags,
                canManage: props.canManage,
                isPending: command.isPending,
                note: command.note,
            }}
            on={{
                voice: setVoice,
                avoid: setAvoid,
                cta: setCta,
                tags: setTags,
                save: () =>
                    command.run(
                        "save",
                        () => writeSaveBrand({ brandVoice: voice, avoid, cta, hashtags: tags }),
                        () => command.say("ok", t("saveDone")),
                    ),
                dismissNote: command.dismiss,
            }}
        />
    )
}
