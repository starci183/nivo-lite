import { useEffect, useRef } from "react"
import type { ReactNode } from "react"
import { PaneSection } from "@starci/grammar/common"

/** Within this distance of the bottom the thread counts as read to the newest and follows new lines. */
const STICK_PX = 80

/** What the scroll band of the thread holds: its accessible name and the thread, or its status in place. */
type OfficeThreadScrollProps = {
    readonly label: string
    readonly children: ReactNode
}

/**
 * The scroll band of the Office conversation pane: a full-bleed log scroller on the canvas whose content takes the pane
 * inset, pinned to the newest line while the reader stays near the bottom (it follows the content as it grows).
 */
export const OfficeThreadScroll = (props: OfficeThreadScrollProps) => {
    const scrollRef = useRef<HTMLDivElement | null>(null)
    const stickRef = useRef(true)

    useEffect(() => {
        const node = scrollRef.current
        if (node === null) return undefined
        const follow = () => {
            if (stickRef.current) node.scrollTop = node.scrollHeight
        }
        const onScroll = () => {
            stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_PX
        }
        follow()
        node.addEventListener("scroll", onScroll, { passive: true })
        const content = node.firstElementChild
        const observer = typeof ResizeObserver === "undefined" || content === null ? null : new ResizeObserver(follow)
        if (content !== null) observer?.observe(content)
        return () => {
            node.removeEventListener("scroll", onScroll)
            observer?.disconnect()
        }
    }, [])

    return (
        <PaneSection scroll={{ label: props.label, role: "log", tone: "background", scrollRef }}>
            {props.children}
        </PaneSection>
    )
}
