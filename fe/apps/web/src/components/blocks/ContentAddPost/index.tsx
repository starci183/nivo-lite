"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    CHANNEL_RULES,
    CONTENT_CHANNELS,
    toInstant,
    useContentCommand,
    useContentFocus,
    type ContentChannel,
    type Pillar,
} from "@/hooks/content"
import { writeCreateItem } from "@/modules/db/content/write-items"
import { ContentAddPostBase } from "./component"

/** Props of {@link ContentAddPost}. */
export interface ContentAddPostProps {
    /** The themes to choose from. */
    readonly pillars: ReadonlyArray<Pillar>
}

/** "Add a post": a manual idea with an optional date, theme and channels, then opened in the editor. */
export const ContentAddPost = (props: ContentAddPostProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const focus = useContentFocus()
    const [isOpen, setOpen] = useState(false)
    const [title, setTitle] = useState("")
    const [date, setDate] = useState("")
    const [time, setTime] = useState("19:30")
    const [pillarId, setPillarId] = useState<string | null>(null)
    const [channels, setChannels] = useState<ReadonlyArray<ContentChannel>>(["facebook"])
    const run = () => {
        const at = toInstant(date, time, "19:30")
        if (at === "date_invalid" || at === "time_invalid") {
            command.say("error", t(at === "date_invalid" ? "dateInvalid" : "timeInvalid"))
            return
        }
        command.run(
            "add",
            () => writeCreateItem({ title, scheduledAt: at, channels, pillarId }),
            (done) => {
                if (done.kind !== "ok") return
                setOpen(false)
                setTitle("")
                focus.open(done.value.id)
            },
        )
    }
    return (
        <ContentAddPostBase
            props={{
                t,
                isOpen,
                title,
                date,
                time,
                pillarId,
                channels,
                channelOptions: CHANNEL_RULES.map((rule) => ({ value: rule.key, label: rule.label })),
                pillarOptions: [
                    { id: "", label: t("noPillar") },
                    ...props.pillars.map((p) => ({ id: p.id, label: p.name })),
                ],
                isPending: command.isPending,
                note: command.note,
            }}
            on={{
                open: () => setOpen(true),
                close: () => setOpen(false),
                title: setTitle,
                date: setDate,
                time: setTime,
                pillar: setPillarId,
                channels: (values) => setChannels(CONTENT_CHANNELS.filter((c) => values.includes(c))),
                run,
                dismissNote: command.dismiss,
            }}
        />
    )
}
