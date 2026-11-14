import type { ReactNode } from "react"
import { Section, SurfaceCard } from "@starci/grammar/common"
import { useInCard } from "./CardScope"

/** What the frame of a block is given. */
interface SurfaceFrameProps {
    /** `card` draws a card on the well; `section` draws a titled section, for a block placed in a surface that already holds it (a side pane): a surface never stands inside a surface. */
    readonly surface: "card" | "section" | "plain" | undefined
    readonly label: string
    readonly isLoading?: boolean
    readonly children: ReactNode
}

/** The frame of a record block: a card on a page, a titled section inside a side pane or inside a card that already stands, nothing at all when the sub-tab already names it. */
export const SurfaceFrame = (props: SurfaceFrameProps): ReactNode => {
    const inCard = useInCard()
    const loading = props.isLoading === true ? { isLoading: true } : {}
    if (props.surface === "plain") return props.children
    if (props.surface === "section" || inCard)
        return (
            <Section title={props.label} headingLevel={2} {...loading}>
                {props.children}
            </Section>
        )
    return (
        <SurfaceCard label={props.label} headingLevel={2} {...loading}>
            {props.children}
        </SurfaceCard>
    )
}
