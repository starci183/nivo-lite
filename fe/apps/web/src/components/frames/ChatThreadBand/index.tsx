import type { ReactNode, Ref } from "react"
import { PaneSection } from "@starci/grammar/common"

/** The thread band: its name, whether it holds messages, and who owns the scroll. */
interface ChatThreadBandProps {
    readonly label: string
    /** Where the content stands in the well: at the foot beside the composer (messages), or in the middle (the greeting notice). */
    readonly placement: "foot" | "middle"
    readonly isWaiting: boolean
    /** The scroll owner, for a thread that opens at its newest message by itself. */
    readonly scrollRef?: Ref<HTMLDivElement>
    readonly children: ReactNode
}

/** The thread of every chat pane: the pink well that fills the height and scrolls, its messages at the foot beside the composer. */
export const ChatThreadBand = (props: ChatThreadBandProps) => (
    <PaneSection
        scroll={{
            label: props.label,
            role: "log",
            align: props.placement === "middle" ? "center" : "end",
            ...(props.scrollRef === undefined ? {} : { scrollRef: props.scrollRef }),
        }}
        isLoading={props.isWaiting}
    >
        {props.children}
    </PaneSection>
)
