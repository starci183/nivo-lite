import { Alert, Button, Text } from "@starci/grammar/common"
import { HiringReplyCard } from "@/components/composites/HiringReplyCard"
import { SlotView } from "@/components/composites/SlotView"
import type { DataSlot, HiringSay, SlotLabels } from "@/modules/types"
import { ANSWERS_CLASS_NAME, PRE_WRAP_CLASS_NAME } from "./classNames"

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

/** Fake data of the same shape: the skeleton reuses the ready tree. */
const LETTER_PLACEHOLDER: HiringOfferLetterView = {
    shop: "",
    heading: "",
    letter: "",
    validUntil: null,
    acceptedTitle: "",
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
    }
    readonly on: {
        readonly answer: (accept: boolean) => void
        readonly retry: () => void
    }
}

/** Props of the card once the letter is known (or its placeholder). */
interface OfferCardProps extends HiringOfferReplyBaseProps {
    readonly view: HiringOfferLetterView
    readonly isSkeleton: boolean
}

/** What follows the letter: the answer given, or the buttons to give one. */
const OfferAnswer = (props: OfferCardProps) => {
    const { say, outcome, isBusy } = props.props
    const { on } = props
    switch (props.shape) {
        case "accepted":
            return <Alert tone="affirmative" title={props.view.acceptedTitle} description={say("replyAcceptedBody")} />
        case "declined":
            return <Alert tone="informative" title={say("replyDeclinedTitle")} />
        case "expired":
            return <Alert tone="cautionary" title={say("replyExpired")} description={say("replyExpiredBody")} />
        case "open":
            if (outcome !== null) return <Alert tone={outcome.isOk ? "affirmative" : "negative"} title={outcome.text} />
            return (
                <div className={ANSWERS_CLASS_NAME}>
                    <Button
                        intent="commit"
                        width="fill"
                        isDisabled={isBusy}
                        isPending={isBusy}
                        isSkeleton={props.isSkeleton}
                        onPress={() => on.answer(true)}
                    >
                        {say("replyAccept")}
                    </Button>
                    <Button
                        intent="alternative"
                        width="fill"
                        isDisabled={isBusy}
                        isSkeleton={props.isSkeleton}
                        onPress={() => on.answer(false)}
                    >
                        {say("replyDecline")}
                    </Button>
                </div>
            )
    }
}

/** Draws the candidate's own offer link: the letter, then the answer buttons (or the answer already given). */
export const HiringOfferReplyBase = (props: HiringOfferReplyBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={LETTER_PLACEHOLDER}
        labels={props.props.slotLabels}
        onRetry={props.on.retry}
    >
        {(view, isSkeleton) => (
            <HiringReplyCard
                say={props.props.say}
                ariaKey="replyOfferTitle"
                shop={view.shop}
                heading={view.heading}
                isSkeleton={isSkeleton}
            >
                <div className={PRE_WRAP_CLASS_NAME}>
                    <Text size="sm" isSkeleton={isSkeleton}>
                        {view.letter}
                    </Text>
                </div>
                {view.validUntil === null ? null : (
                    <Text size="sm" tone="muted">
                        {view.validUntil}
                    </Text>
                )}
                <OfferAnswer {...props} view={view} isSkeleton={isSkeleton} />
            </HiringReplyCard>
        )}
    </SlotView>
)
