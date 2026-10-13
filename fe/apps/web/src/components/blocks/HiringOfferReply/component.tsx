import { Alert, Button, Text } from "@starci/grammar/common"
import { HiringReplyCard } from "@/components/composites/HiringReplyCard"
import type { HiringSay } from "@/hooks/hiring"
import type { ReplyOutcome } from "@/hooks/hiringPublic"
import { ANSWERS_CLASS_NAME, PRE_WRAP_CLASS_NAME } from "./classNames"

/** What the connected block settled for the candidate's offer link. */
export interface HiringOfferReplyBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly state: "loading" | "missing" | "open" | "accepted" | "declined" | "expired"
        readonly shop: string
        readonly heading: string
        readonly letter: string
        readonly validUntil: string | null
        readonly acceptedTitle: string
        readonly outcome: ReplyOutcome | null
        readonly isBusy: boolean
    }
    readonly on: {
        readonly answer: (accept: boolean) => void
    }
}

/** Draws the candidate's own offer link: the letter, then the answer buttons (or the answer already given). */
export const HiringOfferReplyBase = (props: HiringOfferReplyBaseProps) => {
    const { say, state, letter, validUntil, acceptedTitle, outcome, isBusy } = props.props
    const { on } = props
    return (
        <HiringReplyCard
            state={state}
            say={say}
            ariaKey="replyOfferTitle"
            shop={props.props.shop}
            heading={props.props.heading}
        >
            <div className={PRE_WRAP_CLASS_NAME}>
                <Text size="sm">{letter}</Text>
            </div>
            {validUntil === null ? null : (
                <Text size="sm" tone="muted">
                    {validUntil}
                </Text>
            )}
            {state === "accepted" ? (
                <Alert tone="affirmative" title={acceptedTitle} description={say("replyAcceptedBody")} />
            ) : null}
            {state === "declined" ? <Alert tone="informative" title={say("replyDeclinedTitle")} /> : null}
            {state === "expired" ? (
                <Alert tone="cautionary" title={say("replyExpired")} description={say("replyExpiredBody")} />
            ) : null}
            {state === "open" && outcome !== null ? (
                <Alert tone={outcome.isOk ? "affirmative" : "negative"} title={outcome.text} />
            ) : null}
            {state === "open" && outcome === null ? (
                <div className={ANSWERS_CLASS_NAME}>
                    <Button
                        variant="primary"
                        width="fill"
                        isDisabled={isBusy}
                        isPending={isBusy}
                        onPress={() => on.answer(true)}
                    >
                        {say("replyAccept")}
                    </Button>
                    <Button variant="ghost" width="fill" isDisabled={isBusy} onPress={() => on.answer(false)}>
                        {say("replyDecline")}
                    </Button>
                </div>
            ) : null}
        </HiringReplyCard>
    )
}
