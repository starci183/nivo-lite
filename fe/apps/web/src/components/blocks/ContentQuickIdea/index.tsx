"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import {
    CHANNEL_RULES,
    CONTENT_CHANNELS,
    useContentCommand,
    useContentFocus,
    type ContentChannel,
} from "@/hooks/content"
import { writeQuickDraft } from "@/modules/db/content-ai/write-draft"
import { ContentQuickIdeaBase } from "./component"

/** Props of {@link ContentQuickIdea}. */
export interface ContentQuickIdeaProps {
    /** The channels ticked at first (the channels of the posting rhythm). */
    readonly defaultChannels: ReadonlyArray<ContentChannel>
}

/** "Quick idea": paste a topic, choose channels, get a draft per channel and open it in the editor. */
export const ContentQuickIdea = (props: ContentQuickIdeaProps) => {
    const t = useTranslations("content")
    const command = useContentCommand()
    const focus = useContentFocus()
    const [isOpen, setOpen] = useState(false)
    const [topic, setTopic] = useState("")
    const [channels, setChannels] = useState<ReadonlyArray<ContentChannel>>(
        props.defaultChannels.length > 0 ? props.defaultChannels : ["facebook"],
    )
    return (
        <ContentQuickIdeaBase
            props={{
                t,
                isOpen,
                topic,
                channels,
                channelOptions: CHANNEL_RULES.map((rule) => ({ value: rule.key, label: rule.label })),
                isPending: command.isPending,
                note: command.note,
            }}
            on={{
                open: () => setOpen(true),
                close: () => setOpen(false),
                topic: setTopic,
                channels: (values) => setChannels(CONTENT_CHANNELS.filter((c) => values.includes(c))),
                run: () =>
                    command.run(
                        "quick",
                        () => writeQuickDraft(topic, channels),
                        (done) => {
                            if (done.kind !== "ok") return
                            setOpen(false)
                            setTopic("")
                            focus.open(done.value.itemId)
                        },
                    ),
                dismissNote: command.dismiss,
            }}
        />
    )
}
