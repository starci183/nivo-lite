import type { ReactNode } from "react"
import { Button, PaneSection } from "@starci/grammar/common"
import type { PanePrimary } from "@/components/composites/PaneHead"
import { PHONE_ONLY_CLASS_NAME } from "./classNames"

/** What a pane body holds. */
interface PaneBodyProps {
    readonly children: ReactNode
    /** The pane's one filled command, drawn full width above the content on a phone (the head carries it from the medium width). */
    readonly phonePrimary?: PanePrimary
    /**
     * The page's first read has no data yet: every Grammar component in the band draws its skeleton, all at once. Pass the one
     * page-level flag (`isWaitingOf` of hooks/slot) to the head, the list and the body so no region shows data beside a skeleton.
     */
    readonly isWaiting?: boolean
    /**
     * A modal the body opens over the page (a drawer, a dialog): it is drawn inside the band so the route page stays one `Page`
     * with no sibling, and it takes no room of its own because the overlay is portalled.
     */
    readonly overlay?: ReactNode
}

/**
 * The body of a pane that scrolls as a whole: one band with the section gap between its blocks. Put it inside a `Pane` that has
 * `scroll` and a `label`; a pane that needs a fixed band above a scrolling one places its own `PaneSection`s instead.
 */
export const PaneBody = (props: PaneBodyProps) => (
    <PaneSection gap="section" isLoading={props.isWaiting === true}>
        {props.phonePrimary === undefined ? null : (
            <div className={PHONE_ONLY_CLASS_NAME}>
                <Button
                    intent="commit"
                    width="fill"
                    isPending={props.phonePrimary.isPending === true}
                    onPress={props.phonePrimary.onPress}
                    {...(props.phonePrimary.startContent === undefined
                        ? {}
                        : { startContent: props.phonePrimary.startContent })}
                >
                    {props.phonePrimary.label}
                </Button>
            </div>
        )}
        {props.children}
        {props.overlay}
    </PaneSection>
)
