import type { ReactNode } from "react"
import { Pane, PaneGrid, PaneSection } from "@starci/grammar/common"

/** The resolved labels and the two panes' content of the explanation layout. */
interface ExplanationFrameProps {
    readonly label: string
    readonly listLabel: string
    readonly openLabel: string
    readonly closeLabel: string
    /** The lists of what waits and what was done. */
    readonly list: ReactNode
    /** The why pane of the open item; it draws its own status. */
    readonly why: ReactNode
    readonly onClose: () => void
}

/** The responsive list and explanation layout: flush panes on desktop and the same explanation in a phone drawer. */
export const ExplanationFrame = (props: ExplanationFrameProps): ReactNode => (
    <PaneGrid
        label={props.label}
        areas={{ base: ["list"], medium: ["list why"] }}
        columns={{ base: ["fill"], medium: ["fill", "wide"] }}
    >
        <Pane area="list" scroll label={props.listLabel}>
            <PaneSection grow>{props.list}</PaneSection>
        </Pane>
        <Pane
            area="why"
            scroll
            label={props.label}
            collapse="drawer"
            collapseLabel={props.label}
            openLabel={props.openLabel}
            closeLabel={props.closeLabel}
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.onClose()
            }}
        >
            {props.why}
        </Pane>
    </PaneGrid>
)
