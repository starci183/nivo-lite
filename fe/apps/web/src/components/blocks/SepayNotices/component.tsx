import { Alert, Stack } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
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
        /** A disconnected connection is read-only: why, absent while it is connected (the band offers the way back). */
        readonly disconnected?: { readonly title: string; readonly description: string }
    }
    readonly on: {
        readonly retry: () => void
    }
}

/** The geometry the failure notice resolves with; the notice itself is never drawn from it. */
const PLACEHOLDER: SepayNoticeView = { lastError: "" }

/** Draws the refusal, the disconnected state, and the read failing in place or the last delivery failing. */
export const SepayNoticesBase = (props: SepayNoticesBaseProps) => {
    const { slot, disconnected } = props.props
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
            {disconnected === undefined && lastError === "" ? null : (
                <Stack gap="row">
                    {disconnected === undefined ? null : (
                        <Alert tone="informative" title={disconnected.title} description={disconnected.description} />
                    )}
                    {lastError === "" ? null : (
                        <Alert tone="negative" title={props.props.errorTitle} description={lastError} />
                    )}
                </Stack>
            )}
        </>
    )
}
