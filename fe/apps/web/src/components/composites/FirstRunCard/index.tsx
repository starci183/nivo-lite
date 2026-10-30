import type { ReactNode } from "react"
import { Heading, SurfaceCard, Text } from "@starci/grammar/common"
import { CARD_ACTIONS_CLASS_NAME, CARD_HEAD_CLASS_NAME, CARD_STACK_CLASS_NAME } from "./classNames"

/** What a first-run card draws: its question, the line under it, the body and the ways back and on. */
interface FirstRunCardProps {
    /** The accessible name of the card. */
    readonly title: string
    readonly heading: string
    readonly description: string
    /** The way back at the start, the way on at the end. */
    readonly actions: ReactNode
    readonly children: ReactNode
}

/** The card of one first-run step: question and line, the step's rows, and the actions row. */
export const FirstRunCard = (props: FirstRunCardProps) => (
    <SurfaceCard ariaLabel={props.title} measure="form">
        <div className={CARD_STACK_CLASS_NAME}>
            <div className={CARD_HEAD_CLASS_NAME}>
                <Heading level={1}>{props.heading}</Heading>
                <Text tone="muted">{props.description}</Text>
            </div>
            {props.children}
            <div className={CARD_ACTIONS_CLASS_NAME}>{props.actions}</div>
        </div>
    </SurfaceCard>
)
