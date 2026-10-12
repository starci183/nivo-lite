import { GuideBubble as GuideOverlay } from "@/features/overlays/assistant/GuideBubble"

/** Props of the legacy guide entry. */
interface GuideBubbleProps {
    readonly isManager: boolean
}

/** Legacy entry read by the console layout; removed when that layout mounts the overlay itself. */
export const GuideBubble = (props: GuideBubbleProps) => <GuideOverlay isManager={props.isManager} />
