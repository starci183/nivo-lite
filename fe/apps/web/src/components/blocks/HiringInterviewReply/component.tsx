import { Alert, Button, Text } from "@starci/grammar/common"
import { HiringReplyCard } from "@/components/composites/HiringReplyCard"
import type { HiringSay } from "@/hooks/hiring"
import type { ReplyOutcome } from "@/hooks/hiringPublic"
import { SLOTS_CLASS_NAME } from "./classNames"

/** What the connected block settled for the candidate's interview link. */
export interface HiringInterviewReplyBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly state: "loading" | "missing" | "proposed" | "confirmed" | "closed"
        readonly shop: string
        readonly heading: string
        readonly detail: string
        readonly confirmedTitle: string
        readonly slots: ReadonlyArray<{ readonly start: string; readonly label: string }>
        readonly outcome: ReplyOutcome | null
        readonly isBusy: boolean
    }
    readonly on: {
        readonly pick: (start: string | null) => void
    }
}

/** Draws the candidate's own interview link: the invitation, then the times to pick from (or the confirmed time). */
export const HiringInterviewReplyBase = (props: HiringInterviewReplyBaseProps) => {
    const { say, state, detail, confirmedTitle, slots, outcome, isBusy } = props.props
    const { on } = props
    return (
        <HiringReplyCard
            state={state}
            say={say}
            ariaKey="replyInterviewTitle"
            shop={props.props.shop}
            heading={props.props.heading}
        >
            <Text tone="muted">{detail}</Text>
            {state === "confirmed" ? (
                <Alert tone="affirmative" title={confirmedTitle} description={say("replyReminder")} />
            ) : null}
            {state === "closed" ? (
                <Alert tone="cautionary" title={say("replyClosed")} description={say("replyClosedBody")} />
            ) : null}
            {state === "proposed" && outcome !== null ? (
                <Alert tone={outcome.isOk ? "affirmative" : "negative"} title={outcome.text} />
            ) : null}
            {state === "proposed" && outcome === null ? (
                <>
                    <Text weight="medium">{say("replyPick")}</Text>
                    <div className={SLOTS_CLASS_NAME}>
                        {slots.map((slot) => (
                            <Button
                                key={slot.start}
                                intent="neutral"
                                width="fill"
                                isDisabled={isBusy}
                                isPending={isBusy}
                                onPress={() => on.pick(slot.start)}
                            >
                                {slot.label}
                            </Button>
                        ))}
                        <Button intent="neutral" width="fill" isDisabled={isBusy} onPress={() => on.pick(null)}>
                            {say("replyNoFit")}
                        </Button>
                    </div>
                </>
            ) : null}
        </HiringReplyCard>
    )
}
