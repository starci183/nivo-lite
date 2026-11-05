import { Alert, Button, PaneSection, Section, Text } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import { ConnectionPaneLayoutNotice } from "@/components/frames/ConnectionPaneLayout"
import type { ConnectionRefusalView, DataSlot, SlotLabels } from "@/modules/types"

/** What the notices read of the connection: why the last delivery failed, empty when nothing failed. */
interface SepayNoticeView {
    readonly lastError: string
}

/** The notices that open the main pane of a SePay page. */
export interface SepayNoticesBaseProps {
    readonly props: {
        readonly slot: DataSlot<SepayNoticeView>
        readonly labels: SlotLabels
        readonly errorTitle: string
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
        /** The test ran well: the notice that offers real money, absent while it is not offered. */
        readonly live?: { readonly title: string; readonly description: string; readonly label: string }
        /** The question asked before real money is booked: open while the owner has asked for it. */
        readonly confirm: {
            readonly isOpen: boolean
            readonly title: string
            readonly description: string
            readonly confirmLabel: string
            readonly cancelLabel: string
            readonly isPending: boolean
        }
        /** A disconnected connection is read-only: the way to connect it again, absent while it is connected. */
        readonly reconnect?: {
            readonly title: string
            readonly description: string
            readonly label: string
            readonly href: string
        }
    }
    readonly on: {
        readonly retry: () => void
        readonly askLive: () => void
        readonly confirmLive: () => void
        readonly dismiss: () => void
    }
}

/** The geometry the failure notice resolves with; the notice itself is never drawn from it. */
const PLACEHOLDER: SepayNoticeView = { lastError: "" }

/** Draws the refusal, the way back from a disconnected connection, and the read failing in place or the last delivery failing. */
export const SepayNoticesBase = (props: SepayNoticesBaseProps) => {
    const { slot, reconnect, live, confirm } = props.props
    const failed = "isError" in slot || "isForbidden" in slot
    const lastError = "items" in slot ? slot.items.lastError : ""
    return (
        <>
            <ConnectionPaneLayoutNotice refusal={props.props.refusal} />
            {live === undefined ? null : (
                <PaneSection>
                    <Alert
                        tone="informative"
                        title={live.title}
                        description={live.description}
                        action={{ label: live.label, onAction: props.on.askLive }}
                    />
                </PaneSection>
            )}
            {reconnect === undefined ? null : (
                <PaneSection>
                    <Section
                        headingLevel={2}
                        title={reconnect.title}
                        action={
                            <Button intent="alternative" href={reconnect.href}>
                                {reconnect.label}
                            </Button>
                        }
                    >
                        <Text tone="muted">{reconnect.description}</Text>
                    </Section>
                </PaneSection>
            )}
            {failed || lastError !== "" ? (
                <PaneSection>
                    {failed ? (
                        <SlotView
                            slot={slot}
                            placeholder={PLACEHOLDER}
                            labels={props.props.labels}
                            forbidden="notice"
                            onRetry={props.on.retry}
                            render={() => null}
                        />
                    ) : (
                        <Alert tone="negative" title={props.props.errorTitle} description={lastError} />
                    )}
                </PaneSection>
            ) : null}
            <SepayConfirm {...confirm} onConfirm={props.on.confirmLive} onDismiss={props.on.dismiss} />
        </>
    )
}
