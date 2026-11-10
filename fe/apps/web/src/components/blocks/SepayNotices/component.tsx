import { Alert, Stack } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { SepayConfirm } from "@/components/composites/SepayConfirm"
import { ConnectionBandRefusal } from "@/components/frames/ConnectionBand"
import type { ConnectionRefusalView, DataSlot, SlotLabels } from "@/modules/types"

/** What the notices read of the connection: why the last delivery failed, empty when nothing failed. */
interface SepayNoticeView {
    readonly lastError: string
}

/** The notices that open the main column of a SePay page. */
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
        /** A disconnected connection is read-only: why, absent while it is connected (the band offers the way back). */
        readonly disconnected?: { readonly title: string; readonly description: string }
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

/** Draws the refusal, the offer of real money, the disconnected state, and the read failing in place or the last delivery failing. */
export const SepayNoticesBase = (props: SepayNoticesBaseProps) => {
    const { slot, disconnected, live, confirm } = props.props
    const failed = "isError" in slot || "isForbidden" in slot
    const lastError = "items" in slot ? slot.items.lastError : ""
    return (
        <>
            <ConnectionBandRefusal refusal={props.props.refusal} />
            {failed ? (
                <SlotView
                    slot={slot}
                    placeholder={PLACEHOLDER}
                    labels={props.props.labels}
                    forbidden="notice"
                    onRetry={props.on.retry}
                    render={() => null}
                />
            ) : null}
            {live === undefined && disconnected === undefined && lastError === "" ? null : (
                <Stack gap="row">
                    {live === undefined ? null : (
                        <Alert
                            tone="informative"
                            title={live.title}
                            description={live.description}
                            action={{ label: live.label, onAction: props.on.askLive }}
                        />
                    )}
                    {disconnected === undefined ? null : (
                        <Alert tone="informative" title={disconnected.title} description={disconnected.description} />
                    )}
                    {lastError === "" ? null : (
                        <Alert tone="negative" title={props.props.errorTitle} description={lastError} />
                    )}
                </Stack>
            )}
            <SepayConfirm {...confirm} onConfirm={props.on.confirmLive} onDismiss={props.on.dismiss} />
        </>
    )
}
