import { createContext, useContext, useEffect, useRef } from "react"
import type { ReactNode } from "react"

/** The sticky head of the aside pane that a block inside it asks for: the record it shows, what kind it is and how to close it. */
export interface AsideHead {
    readonly title: string
    /** The muted line under the title. */
    readonly description?: string
    /** Closes the record; the head draws a small close button when given. */
    readonly onClose?: () => void
    /** The accessible name of the close button; required with `onClose`. */
    readonly closeLabel?: string
}

/** What the aside frame offers its blocks. */
interface AsideHeadHost {
    /** Sets the head of the pane; null takes it away. */
    readonly setHead: (head: AsideHead | null) => void
}

const AsideHeadContext = createContext<AsideHeadHost | null>(null)

/** What the provider takes. */
interface AsideHeadProviderProps {
    readonly setHead: (head: AsideHead | null) => void
    /** Whether the pane draws the head: a narrow screen draws the aside as a block of the well, with no head of its own. */
    readonly isHosted: boolean
    readonly children: ReactNode
}

/** Marks the aside region: a block placed in it may ask its pane for a sticky head, where the screen draws the aside as a pane. */
export const AsideHeadProvider = (props: AsideHeadProviderProps): ReactNode => (
    <AsideHeadContext.Provider value={props.isHosted ? { setHead: props.setHead } : null}>
        {props.children}
    </AsideHeadContext.Provider>
)

/**
 * Asks the aside pane for a sticky one-row head while this block stands in it. Returns whether the pane draws it: when it does not (the
 * block stands on a page, or the aside is a block of the well on a narrow screen) the block draws its own head.
 */
export const useAsideHead = (head: AsideHead | null): boolean => {
    const host = useContext(AsideHeadContext)
    const latest = useRef(head)
    useEffect(() => {
        latest.current = head
    })
    const key = head === null ? "" : JSON.stringify([head.title, head.description, head.closeLabel])
    const hasHead = head !== null
    useEffect(() => {
        if (host === null || !hasHead) return undefined
        const current = latest.current
        if (current === null) return undefined
        host.setHead({
            title: current.title,
            ...(current.description === undefined ? {} : { description: current.description }),
            ...(current.onClose === undefined || current.closeLabel === undefined
                ? {}
                : { onClose: () => latest.current?.onClose?.(), closeLabel: current.closeLabel }),
        })
        return () => host.setHead(null)
    }, [host, hasHead, key])
    return host !== null && hasHead
}
