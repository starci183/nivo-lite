import type { ReactNode } from "react"
import { Alert, Heading, SurfaceCard, Text } from "@starci/grammar/common"
import type { HiringSay } from "@/hooks/hiring"
import { CARD_CLASS_NAME } from "./classNames"

/** The words of the card and what it holds. */
interface HiringReplyCardProps {
    /** "loading" and "missing" draw a notice; any other state draws the card. */
    readonly state: string
    readonly say: HiringSay
    readonly ariaKey: string
    readonly shop: string
    readonly heading: string
    readonly children: ReactNode
}

/** The card of a candidate's own link: the business, the heading and the content, or a notice while it loads or when the link is no longer valid. */
export const HiringReplyCard = (props: HiringReplyCardProps) => {
    if (props.state === "loading") return <Alert tone="informative" title={props.say("loading")} />
    if (props.state === "missing") {
        return <Alert tone="cautionary" title={props.say("replyInvalid")} description={props.say("replyInvalidBody")} />
    }
    return (
        <SurfaceCard ariaLabel={props.say(props.ariaKey)}>
            <div className={CARD_CLASS_NAME}>
                <Text size="sm" tone="muted">
                    {props.shop}
                </Text>
                <Heading level={1} scale="standard">
                    {props.heading}
                </Heading>
                {props.children}
            </div>
        </SurfaceCard>
    )
}
