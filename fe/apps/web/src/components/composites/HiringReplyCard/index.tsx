import type { ReactNode } from "react"
import { Heading, SurfaceCard, Text } from "@starci/grammar/common"
import type { HiringSay } from "@/modules/types"
import { CARD_CLASS_NAME } from "./classNames"

/** The words of the card and what it holds. */
interface HiringReplyCardProps {
    readonly say: HiringSay
    readonly ariaKey: string
    readonly shop: string
    readonly heading: string
    /** Drawn from the placeholder of a link that is still read. */
    readonly isSkeleton: boolean
    readonly children: ReactNode
}

/** The card of a candidate's own link: the business, the heading and the content. */
export const HiringReplyCard = (props: HiringReplyCardProps) => (
    <SurfaceCard ariaLabel={props.say(props.ariaKey)}>
        <div className={CARD_CLASS_NAME}>
            <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                {props.shop}
            </Text>
            <Heading level={1} scale="standard" isSkeleton={props.isSkeleton}>
                {props.heading}
            </Heading>
            {props.children}
        </div>
    </SurfaceCard>
)
