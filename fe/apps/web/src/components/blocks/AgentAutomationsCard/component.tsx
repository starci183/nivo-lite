import { Alert, SurfaceCard, Text, TextAction } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { STACK } from "./classNames"

/** Copy and state of the automations card of an agent. */
export interface AgentAutomationsCardBaseProps {
    readonly props: {
        readonly title: string
        readonly seeAllLabel: string
        readonly seeAllHref: string
        readonly help: string
        readonly loadingText: string
        readonly failureTitle: string
        readonly retryLabel: string
        readonly isFailed: boolean
        readonly isLoaded: boolean
    }
    readonly on: { readonly retry: () => void }
    /** The board of the automations of the module, once it is loaded. */
    readonly children?: ReactNode
}

/** Draws the compact list of the automations of a module: loading, failed with a retry, or the board. */
export const AgentAutomationsCardBase = (props: AgentAutomationsCardBaseProps) => (
    <SurfaceCard
        label={props.props.title}
        headingLevel={2}
        labelEnd={
            <TextAction href={props.props.seeAllHref} size="sm" appearance="inline">
                {props.props.seeAllLabel}
            </TextAction>
        }
    >
        <div className={STACK}>
            <Text size="sm" tone="muted">
                {props.props.help}
            </Text>
            {props.props.isFailed ? (
                <Alert
                    tone="negative"
                    title={props.props.failureTitle}
                    action={{ label: props.props.retryLabel, onAction: props.on.retry }}
                />
            ) : null}
            {!props.props.isFailed && !props.props.isLoaded ? (
                <Text size="sm" tone="muted" live="polite">
                    {props.props.loadingText}
                </Text>
            ) : null}
            {!props.props.isFailed && props.props.isLoaded ? props.children : null}
        </div>
    </SurfaceCard>
)
