import { Alert, Stack } from "@starci/grammar/common"
import type { PresentationState } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { ConnectionBandRefusal } from "@/components/frames/ConnectionBand"
import type { ConnectionRefusalView, DataSlot, SlotLabels, ZaloHeadView } from "@/modules/types"

/** The head read, used only to say it failed in place. */
const ZALO_HEAD_PLACEHOLDER: ZaloHeadView = { name: "-", chipLabel: "-", chipTone: "neutral", facts: "-", banner: "" }

/** One notice of the page: why the OA cannot send, a refused command, or the one step left. */
interface ZaloPageNotice {
    readonly id: string
    readonly tone: PresentationState
    readonly title: string
    readonly description?: string
}

/** The notices that open the main pane of a Zalo OA page. */
export interface ZaloConnectionNoticesBaseProps {
    readonly props: {
        readonly head: DataSlot<ZaloHeadView>
        readonly slotLabels: SlotLabels
        readonly notices: ReadonlyArray<ZaloPageNotice>
        /** The notice drawn in place of the page for a member who may not read it. */
        readonly refusal?: ConnectionRefusalView
    }
    readonly on: { readonly retry: () => void }
}

/** Draws the refusal, the head read failing in place, and the notices in reading order; nothing when there is none. */
export const ZaloConnectionNoticesBase = (props: ZaloConnectionNoticesBaseProps) => {
    const { head, notices } = props.props
    const failed = "isError" in head || "isForbidden" in head
    return (
        <>
            <ConnectionBandRefusal refusal={props.props.refusal} />
            {failed ? (
                <SlotView
                    slot={head}
                    placeholder={ZALO_HEAD_PLACEHOLDER}
                    labels={props.props.slotLabels}
                    forbidden="notice"
                    onRetry={props.on.retry}
                    render={() => null}
                />
            ) : null}
            {notices.length === 0 ? null : (
                <Stack gap="row">
                    {notices.map((notice) => (
                        <Alert
                            key={notice.id}
                            tone={notice.tone}
                            title={notice.title}
                            {...(notice.description === undefined ? {} : { description: notice.description })}
                        />
                    ))}
                </Stack>
            )}
        </>
    )
}
