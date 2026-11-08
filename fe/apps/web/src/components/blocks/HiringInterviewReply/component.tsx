import {
    Alert,
    AlertDialog,
    Button,
    Cluster,
    Heading,
    Page,
    RadioGroup,
    Stack,
    SurfaceCard,
    Text,
    TextAction,
    type HeaderZone,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { HiringReplyOutcome } from "@/components/composites/HiringReplyOutcome"
import { PublicShell } from "@/components/frames/PublicShell"
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
const GHOST = "M".repeat(24)

const INVITE_PLACEHOLDER: HiringInterviewInviteView = {
    shop: GHOST,
    heading: GHOST.repeat(2),
    detail: GHOST.repeat(3),
    confirmedTitle: GHOST,
    slots: ["a", "b", "c"].map((start) => ({ start, label: GHOST })),
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
        /** The time the candidate chose; empty before a choice. */
        readonly selected: string
        /** A send without a choice asks for one. */
        readonly isMissing: boolean
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly isPending: boolean
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
        readonly failedBody: string
    }
    readonly on: {
        readonly select: (start: string) => void
        readonly confirm: () => void
        readonly pick: (start: string | null) => void
        readonly retry: () => void
        readonly chooseLanguage: (locale: string) => void
    }
}

/** Props of the card once the invitation is known (or its placeholder). */
interface InviteCardProps extends HiringInterviewReplyBaseProps {
    readonly view: HiringInterviewInviteView
    readonly isLoading: boolean
}

/** The invitation itself: the business, the greeting as the page's heading, and where and when. */
const inviteBand = (props: InviteCardProps): HeaderZone => ({
    kind: "custom",
    children: (
        <Stack gap="row">
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {props.view.shop}
            </Text>
            <Heading level={1} isLoading={props.isLoading}>
                {props.view.heading}
            </Heading>
            <Text tone="muted" isLoading={props.isLoading}>
                {props.view.detail}
            </Text>
        </Stack>
    ),
})

/** The times as one choice, then the quiet way to say none fits (asks first) and the one primary command. */
const InviteSlots = (props: InviteCardProps) => {
    const { say, isBusy, selected, isMissing } = props.props
    const { on } = props
    return (
        <Stack gap="row">
            <RadioGroup
                label={say("replyPick")}
                isLabelHidden
                name="slot"
                appearance="rows"
                isLoading={props.isLoading}
                isDisabled={isBusy}
                options={props.view.slots.map((slot) => ({ value: slot.start, label: slot.label }))}
                value={selected === "" ? null : selected}
                onValueChange={on.select}
            />
            {isMissing ? <Alert tone="negative" title={say("replyNeedSlot")} /> : null}
            <Cluster gap="row" justify="between">
                <AlertDialog
                    title={say("replyNoFitTitle")}
                    description={say("replyNoFitBody")}
                    tone="informative"
                    confirmLabel={say("replySend")}
                    cancelLabel={say("replyBack")}
                    onConfirm={() => on.pick(null)}
                    trigger={<TextAction size="sm">{say("replyNoFit")}</TextAction>}
                />
                <Button intent="commit" isPending={isBusy} isLoading={props.isLoading} onPress={on.confirm}>
                    {say("replyConfirm")}
                </Button>
            </Cluster>
        </Stack>
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
            if (outcome !== null) return <HiringReplyOutcome outcome={outcome} />
            return <InviteSlots {...props} />
    }
}

/** Draws the candidate's own interview link: one card, the invitation, then the times to pick from (or the confirmed time). */
export const HiringInterviewReplyBase = (props: HiringInterviewReplyBaseProps) => {
    const { shape } = props
    return (
        <Page chrome="bleed" minHeight="none">
            <PublicShell
                label={props.props.say("replyInterviewTitle")}
                foot={props.props.say("replyFoot")}
                measure="reading"
                brand={{
                    name: "items" in props.props.slot ? props.props.slot.items.shop : null,
                    isLoading: "isLoading" in props.props.slot,
                    fallbackLabel: props.props.say("brandFallback"),
                }}
                language={props.props.language}
                onChooseLanguage={props.on.chooseLanguage}
            >
                <SlotView
                    slot={props.props.slot}
                    placeholder={INVITE_PLACEHOLDER}
                    labels={props.props.slotLabels}
                    errorDescription={props.props.failedBody}
                    onRetry={props.on.retry}
                    render={(view, isLoading) => (
                        <Stack gap="region" measure="form">
                            <SurfaceCard
                                ariaLabel={props.props.say("replyInterviewTitle")}
                                isLoading={isLoading}
                                headers={[inviteBand({ ...props, view, isLoading })]}
                            >
                                <InviteAnswer {...props} shape={shape} view={view} isLoading={isLoading} />
                            </SurfaceCard>
                        </Stack>
                    )}
                />
            </PublicShell>
        </Page>
    )
}
