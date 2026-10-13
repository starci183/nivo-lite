import type { ReactNode } from "react"
import { ChatBubble, SurfaceCard } from "@starci/grammar/common"
import { AVATAR_SLOT_CLASS_NAME, BODY_CLASS_NAME, CARD_CLASS_NAME, ROW_FIRST_CLASS_NAME } from "./classNames"

/** What the frame of a decision card in the thread draws. */
type OfficeCardFrameProps = {
    /** The DOM id a jump scrolls to. */
    readonly id?: string
    readonly author: string
    readonly avatar: ReactNode
    readonly status?: ReactNode
    readonly meta?: string
    /** The accessible name of the card. */
    readonly label: string
    readonly isHighlight?: boolean
    /** The agent's line above the card. */
    readonly head: ReactNode
    /** The content of the card. */
    readonly children: ReactNode
}

/** A decision card as a message from an agent: the line, then a nested card under it that holds the content. */
export const OfficeCardFrame = (props: OfficeCardFrameProps) => (
    <div className={ROW_FIRST_CLASS_NAME}>
        <ChatBubble
            id={props.id}
            author={props.author}
            avatar={<div className={AVATAR_SLOT_CLASS_NAME}>{props.avatar}</div>}
            status={props.status}
            meta={props.meta}
            footer={
                <div className={CARD_CLASS_NAME}>
                    <SurfaceCard depth="nested" ariaLabel={props.label} isHighlight={props.isHighlight}>
                        <div className={BODY_CLASS_NAME}>{props.children}</div>
                    </SurfaceCard>
                </div>
            }
        >
            {props.head}
        </ChatBubble>
    </div>
)
