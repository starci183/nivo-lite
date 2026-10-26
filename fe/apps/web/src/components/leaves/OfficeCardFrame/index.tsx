import type { ReactNode } from "react"
import { Badge, ChatBubble, SurfaceCard } from "@starci/grammar/common"
import type { OfficeCardIdentity } from "@/modules/types"
import { AVATAR_SLOT_CLASS_NAME, BODY_CLASS_NAME, CARD_CLASS_NAME, ROW_FIRST_CLASS_NAME } from "./classNames"

/** What the frame of a decision card in the thread draws. */
type OfficeCardFrameProps = {
    /** The DOM id a jump scrolls to. */
    readonly id?: string | undefined
    /** An agent card: who posted it, when, and whether it is focused; it fills id, author, meta, label and the highlight. */
    readonly identity?: OfficeCardIdentity
    /** The AI mark shown when `identity` says an agent wrote the card. */
    readonly aiLabel?: string
    readonly author?: string
    readonly avatar: ReactNode
    readonly status?: ReactNode
    readonly meta?: string
    /** The accessible name of the card. */
    readonly label?: string
    readonly isHighlight?: boolean
    /** The agent's line above the card. */
    readonly head: ReactNode
    /** The content of the card. */
    readonly children: ReactNode
}

/** The status mark of an agent card: the AI badge when an agent wrote it. */
const aiStatusOf = (identity: OfficeCardIdentity | undefined, aiLabel: string | undefined): ReactNode =>
    identity?.isAi === true && aiLabel !== undefined ? <Badge tone="neutral">{aiLabel}</Badge> : undefined

/** A decision card as a message from an agent: the line, then a nested card under it that holds the content. */
export const OfficeCardFrame = (props: OfficeCardFrameProps) => {
    const anchor = props.identity?.anchor ?? props.id
    const meta = props.identity?.time ?? props.meta
    const isHighlight = props.identity?.isFocused ?? props.isHighlight
    return (
        <div className={ROW_FIRST_CLASS_NAME}>
            <ChatBubble
                {...(anchor === undefined ? {} : { id: anchor })}
                author={props.identity?.author ?? props.author ?? ""}
                avatar={<div className={AVATAR_SLOT_CLASS_NAME}>{props.avatar}</div>}
                status={props.status ?? aiStatusOf(props.identity, props.aiLabel)}
                {...(meta === undefined ? {} : { meta })}
                footer={
                    <div className={CARD_CLASS_NAME}>
                        <SurfaceCard
                            ariaLabel={props.identity?.title ?? props.label ?? ""}
                            {...(isHighlight === undefined ? {} : { isHighlight })}
                        >
                            <div className={BODY_CLASS_NAME}>{props.children}</div>
                        </SurfaceCard>
                    </div>
                }
            >
                {props.head}
            </ChatBubble>
        </div>
    )
}
