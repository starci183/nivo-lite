import { Alert, AlertDialog, Button, Cluster, Heading, Page, Stack, SurfaceCard, Text } from "@starci/grammar/common"
import type { HeaderZone } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { HiringReplyOutcome } from "@/components/composites/HiringReplyOutcome"
import { PublicShell } from "@/components/frames/PublicShell"
import type { DataSlot, HiringSay, SlotLabels } from "@/modules/types"
import { PRE_WRAP_CLASS_NAME } from "./classNames"

/** The offer shapes: open to an answer, answered either way, or past its date. */
export const HIRING_OFFER_REPLY_SHAPES = ["open", "accepted", "declined", "expired"] as const
/** One drawing per state of the letter. */
export type HiringOfferReplyShape = (typeof HIRING_OFFER_REPLY_SHAPES)[number]

/** The letter the candidate reads, with its display text resolved. */
export interface HiringOfferLetterView {
    readonly shop: string
    readonly heading: string
    readonly letter: string
    readonly validUntil: string | null
    readonly acceptedTitle: string
}

/** Unseen text that gives a skeleton line the width of a real one. */
const GHOST = "M".repeat(28)

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const LETTER_PLACEHOLDER: HiringOfferLetterView = {
    shop: GHOST,
    heading: GHOST,
    letter: GHOST.repeat(6),
    validUntil: GHOST,
    acceptedTitle: GHOST,
}

/** What the connected block settled for the candidate's offer link. */
export interface HiringOfferReplyBaseProps {
    readonly shape: HiringOfferReplyShape
    readonly props: {
        readonly say: HiringSay
        readonly slot: DataSlot<HiringOfferLetterView>
        readonly slotLabels: SlotLabels
        readonly outcome: { readonly isOk: boolean; readonly text: string } | null
        readonly isBusy: boolean
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly isPending: boolean
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
        readonly failedBody: string
    }
    readonly on: {
        readonly answer: (accept: boolean) => void
        readonly retry: () => void
        readonly chooseLanguage: (locale: string) => void
    }
}

/** Props of the card once the letter is known (or its placeholder). */
interface OfferCardProps extends HiringOfferReplyBaseProps {
    readonly view: HiringOfferLetterView
    readonly isSkeleton: boolean
}

/** The one decision group: the way out first, then the primary. Both ask before they send, because neither can be taken back here. */
const OfferDecision = (props: Pick<OfferCardProps, "props" | "on" | "isSkeleton">) => {
    const { say, isBusy } = props.props
    const { on } = props
    return (
        <Cluster gap="row" justify="end">
            <AlertDialog
                title={say("replyDeclineTitle")}
                description={say("replyDeclineBody")}
                tone="negative"
                confirmLabel={say("replyDeclineConfirm")}
                cancelLabel={say("replyBack")}
                onConfirm={() => on.answer(false)}
                trigger={
                    <Button intent="alternative" isLoading={props.isSkeleton} isPending={isBusy}>
                        {say("replyDecline")}
                    </Button>
                }
            />
            <AlertDialog
                title={say("replyAcceptTitle")}
                description={say("replyAcceptBody")}
                tone="informative"
                confirmLabel={say("replyAcceptConfirm")}
                cancelLabel={say("replyBack")}
                onConfirm={() => on.answer(true)}
                trigger={
                    <Button intent="commit" isLoading={props.isSkeleton} isPending={isBusy}>
                        {say("replyAccept")}
                    </Button>
                }
            />
        </Cluster>
    )
}

/** What follows the letter: the answer given, or the decision to give one. */
const OfferAnswer = (props: OfferCardProps) => {
    const { say, outcome } = props.props
    if (props.shape === "accepted")
        return <Alert tone="affirmative" title={props.view.acceptedTitle} description={say("replyAcceptedBody")} />
    if (props.shape === "declined")
        return <Alert tone="informative" title={say("replyDeclinedTitle")} description={say("replyDeclinedBody")} />
    if (props.shape === "expired")
        return <Alert tone="cautionary" title={say("replyExpired")} description={say("replyExpiredBody")} />
    return outcome === null ? <OfferDecision {...props} /> : <HiringReplyOutcome outcome={outcome} />
}

/** The letter: the business and the heading, then the words, then how long it holds (only while it still holds). */
const offerHeaders = (props: OfferCardProps): [HeaderZone, HeaderZone] => {
    const { view, isSkeleton } = props
    return [
        {
            kind: "custom",
            children: (
                <Stack gap="row">
                    <Text size="sm" tone="muted" isLoading={isSkeleton}>
                        {view.shop}
                    </Text>
                    <Heading level={1} isLoading={isSkeleton}>
                        {view.heading}
                    </Heading>
                </Stack>
            ),
        },
        {
            kind: "custom",
            children: (
                <Stack gap="row">
                    <div className={PRE_WRAP_CLASS_NAME}>
                        <Text isLoading={isSkeleton}>{view.letter}</Text>
                    </div>
                    {view.validUntil === null || props.shape === "expired" ? null : (
                        <Text size="xs" tone="muted" isLoading={isSkeleton}>
                            {view.validUntil}
                        </Text>
                    )}
                </Stack>
            ),
        },
    ]
}

/** The bar, the language menu and the foot line around the offer card. */
const offerShellOf = (props: HiringOfferReplyBaseProps) => ({
    label: props.props.say("replyOfferTitle"),
    foot: props.props.say("replyFoot"),
    measure: "reading" as const,
    brand: {
        name: "items" in props.props.slot ? props.props.slot.items.shop : null,
        isLoading: "isLoading" in props.props.slot,
        fallbackLabel: props.props.say("brandFallback"),
    },
    language: props.props.language,
    onChooseLanguage: props.on.chooseLanguage,
})

/** The read of the offer link, the way the slot draws it. */
const offerSlotOf = (props: HiringOfferReplyBaseProps) => ({
    slot: props.props.slot,
    placeholder: LETTER_PLACEHOLDER,
    labels: props.props.slotLabels,
    errorDescription: props.props.failedBody,
    onRetry: props.on.retry,
})

/** Draws the candidate's own offer link: one card with the letter, then the decision (or the answer already given). */
export const HiringOfferReplyBase = (props: HiringOfferReplyBaseProps) => {
    return (
        <Page chrome="bleed" minHeight="none">
            <PublicShell {...offerShellOf(props)}>
                <SlotView
                    {...offerSlotOf(props)}
                    render={(view, isSkeleton) => (
                        <Stack gap="region" measure="form">
                            <SurfaceCard
                                ariaLabel={props.props.say("replyOfferTitle")}
                                isLoading={isSkeleton}
                                headers={offerHeaders({ ...props, view, isSkeleton })}
                            >
                                <OfferAnswer {...props} view={view} isSkeleton={isSkeleton} />
                            </SurfaceCard>
                        </Stack>
                    )}
                />
            </PublicShell>
        </Page>
    )
}
