import { Heading, Alert, Button, Text, Stack } from "@starci/grammar/common"
import { HiringReplyCard } from "@/components/frames/HiringReplyCard"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, HiringSay, SlotLabels } from "@/modules/types"
/** The interview shapes: times proposed to pick from, one confirmed, or the invitation closed. */
export const HIRING_INTERVIEW_REPLY_SHAPES = ["proposed", "confirmed", "closed"] as const
/** One drawing per state of the invitation. */
export type HiringInterviewReplyShape = (typeof HIRING_INTERVIEW_REPLY_SHAPES)[number]

/** The invitation the candidate reads, with its display text resolved. */
export interface HiringInterviewInviteView {
    readonly shop: string
    readonly heading: string
    readonly detail: string
    readonly confirmedTitle: string
    readonly slots: ReadonlyArray<{ readonly start: string; readonly label: string }>
}

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const INVITE_PLACEHOLDER: HiringInterviewInviteView = {
    shop: "",
    heading: "",
    detail: "",
    confirmedTitle: "",
    slots: [{ start: "loading", label: "" }],
}

/** What the connected block settled for the candidate's interview link. */
export interface HiringInterviewReplyBaseProps {
    readonly shape: HiringInterviewReplyShape
    readonly props: {
        readonly say: HiringSay
        readonly slot: DataSlot<HiringInterviewInviteView>
        readonly slotLabels: SlotLabels
        readonly outcome: { readonly isOk: boolean; readonly text: string } | null
        readonly isBusy: boolean
    }
    readonly on: {
        readonly pick: (start: string | null) => void
        readonly retry: () => void
    }
}

/** Props of the card once the invitation is known (or its placeholder). */
interface InviteCardProps extends HiringInterviewReplyBaseProps {
    readonly view: HiringInterviewInviteView
    readonly isLoading: boolean
}

/** The times to pick from, and the way to say none fits. */
const InviteSlots = (props: InviteCardProps) => {
    const { say, isBusy } = props.props
    const { on } = props
    return (
        <>
            <Heading level={3} isLoading={props.isLoading}>
                {say("replyPick")}
            </Heading>
            <Stack gap="inline">
                {props.view.slots.map((slot) => (
                    <Button
                        key={slot.start}
                        intent="neutral"
                        width="fill"
                        isDisabled={isBusy}
                        isPending={isBusy}
                        isLoading={props.isLoading}
                        onPress={() => on.pick(slot.start)}
                    >
                        {slot.label}
                    </Button>
                ))}
                <Button
                    intent="neutral"
                    width="fill"
                    isDisabled={isBusy}
                    isLoading={props.isLoading}
                    onPress={() => on.pick(null)}
                >
                    {say("replyNoFit")}
                </Button>
            </Stack>
        </>
    )
}

/** What follows the invitation: the confirmed time, the closing notice, or the times to pick from. */
const InviteAnswer = (props: InviteCardProps) => {
    const { say, outcome } = props.props
    switch (props.shape) {
        case "confirmed":
            return <Alert tone="affirmative" title={props.view.confirmedTitle} description={say("replyReminder")} />
        case "closed":
            return <Alert tone="cautionary" title={say("replyClosed")} description={say("replyClosedBody")} />
        case "proposed":
            if (outcome !== null) return <Alert tone={outcome.isOk ? "affirmative" : "negative"} title={outcome.text} />
            return <InviteSlots {...props} />
    }
}

/** Draws the candidate's own interview link: the invitation, then the times to pick from (or the confirmed time). */
export const HiringInterviewReplyBase = (props: HiringInterviewReplyBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={INVITE_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
        render={(view, isLoading) => (
            <HiringReplyCard
                say={props.props.say}
                ariaKey="replyInterviewTitle"
                shop={
                    <Text size="sm" tone="muted" isLoading={isLoading}>
                        {view.shop}
                    </Text>
                }
                heading={
                    <Heading level={1} isLoading={isLoading}>
                        {view.heading}
                    </Heading>
                }
            >
                <Text tone="muted" isLoading={isLoading}>
                    {view.detail}
                </Text>
                <InviteAnswer {...props} view={view} isLoading={isLoading} />
            </HiringReplyCard>
        )}
    />
)
