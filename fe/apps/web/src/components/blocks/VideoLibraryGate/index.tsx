"use client"

import type { ReactNode } from "react"
import { useTranslations } from "next-intl"
import { useSlotLabels } from "@/hooks/slot"
import { useVideoLibraryGate } from "@/hooks/video"
import { workbenchGateSlot } from "@/hooks/workbenchGate"
import { VideoLibraryGateBase } from "./component"

/** What the page tells the library gate. */
interface VideoLibraryGateProps {
    /** The blocks that need the library. */
    readonly children: ReactNode
    /** The name of the panel, drawn as a skeleton while the library is read. */
    readonly placeholder: string
}

/** Lets the blocks below it render once the library and the brand kit are read; a skeleton meanwhile. */
export const VideoLibraryGate = (props: VideoLibraryGateProps) => {
    const t = useTranslations("video")
    const slotLabels = useSlotLabels()
    const gate = useVideoLibraryGate()
    return (
        <VideoLibraryGateBase
            shape={{ content: props.children }}
            props={{
                slot: workbenchGateSlot(gate.state, true),
                slotLabels: slotLabels(t("loadFailedTitle")),
                placeholder: props.placeholder,
            }}
            on={{ retry: gate.reload }}
        />
    )
}
