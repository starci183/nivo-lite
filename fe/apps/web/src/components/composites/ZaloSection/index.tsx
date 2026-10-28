import { SurfaceListCard } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** A titled list card of the Zalo connection page. */
type ZaloSectionProps = {
    readonly title: string
    readonly isSkeleton: boolean
    readonly end?: ReactNode
    readonly children: ReactNode
}

/** The list card every region of the Zalo connection page uses: a level 2 title, an optional mark after it, and the rows. */
export const ZaloSection = (props: ZaloSectionProps) => (
    <SurfaceListCard
        label={props.title}
        headingLevel={2}
        isLoading={props.isSkeleton}
        {...(props.end === undefined ? {} : { labelEnd: props.end })}
    >
        {props.children}
    </SurfaceListCard>
)
