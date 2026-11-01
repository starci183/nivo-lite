import type { ReactNode } from "react"
import { Alert, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import { STACK_CLASS } from "./classNames"

/** What the frame of the automations of a module shows, already in the reader language. */
type AgentAutomationsFrameProps = {
    readonly title: string
    readonly seeAllLabel: string
    readonly seeAllHref: string
    readonly help: string
    /** Set when the automations could not be read: the card says so instead of showing the board. */
    readonly failureTitle?: string
    /** The board of the automations of the module. */
    readonly children?: ReactNode
}

/** The card around the compact board of the automations of a module: its title, a help line, the board, and the link to all of them under it. */
export const AgentAutomationsFrame = (props: AgentAutomationsFrameProps) => (
    <SurfaceCard label={props.title} headingLevel={2}>
        <div className={STACK_CLASS}>
            <Text size="sm" tone="muted">
                {props.help}
            </Text>
            {props.failureTitle === undefined ? props.children : <Alert tone="negative" title={props.failureTitle} />}
            <TextAction href={props.seeAllHref} size="sm" appearance="inline">
                {props.seeAllLabel}
            </TextAction>
        </div>
    </SurfaceCard>
)
