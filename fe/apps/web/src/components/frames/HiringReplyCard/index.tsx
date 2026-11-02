import type { ReactNode } from "react"
import { SurfaceCard } from "@starci/grammar/common"
import type { HiringSay } from "@/modules/types"
import { CARD_CLASS_NAME } from "./classNames"

/** The words of the card and what it holds. */
interface HiringReplyCardProps {
    readonly say: HiringSay
    readonly ariaKey: string
    readonly shop: ReactNode
    readonly heading: ReactNode
    readonly children: ReactNode
}

/** The card of a candidate's own link: the business, the heading and the content. */
export const HiringReplyCard = (props: HiringReplyCardProps) => (
    <SurfaceCard ariaLabel={props.say(props.ariaKey)}>
        <div className={CARD_CLASS_NAME}>
            {props.shop}
            {props.heading}
            {props.children}
        </div>
    </SurfaceCard>
)
