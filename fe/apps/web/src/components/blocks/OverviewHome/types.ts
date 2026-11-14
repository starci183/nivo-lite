import type { OverviewRegionsCopy } from "@/components/frames/OverviewRegions"
import type { StaffHomeFigure, StaffHomeList } from "@/components/frames/StaffHomeRegions"
import type { OverviewPeriod } from "@/hooks/overview"
import type { DataSlot, OverviewView, SlotLabels } from "@/modules/types"

/** The home that is drawn: the business dashboard of an owner or manager, or the day of a member of staff. */
export type OverviewHomeShape = "manager" | "staff"

/** The words of the owner's overview: its header band, then the words of its regions. */
export interface OverviewManagerCopy extends OverviewRegionsCopy {
    readonly title: string
    readonly description: string
    readonly periodLabel: string
    readonly periods: Readonly<Record<OverviewPeriod, string>>
    readonly exportLabel: string
    readonly forbiddenBody: string
    readonly agentsOpen: string
}

/** What the owner's overview is told. */
export interface OverviewManagerProps {
    readonly copy: OverviewManagerCopy
    readonly period: OverviewPeriod
    /** The periods the switch lists, in order. */
    readonly periods: ReadonlyArray<OverviewPeriod>
    readonly slot: DataSlot<OverviewView>
    readonly placeholder: OverviewView
    readonly labels: SlotLabels
    /** A phone's screen: what needs the owner comes first. */
    readonly isPhone: boolean
    /** Where the head links of the regions lead: the team chat and the agents. */
    readonly chatHref: string
    readonly agentsHref: string
}

/** What the staff home is told. */
export interface OverviewStaffProps {
    readonly title: string
    readonly description: string
    readonly figuresLabel: string
    readonly figures: ReadonlyArray<StaffHomeFigure>
    readonly isFiguresLoading: boolean
    readonly work: StaffHomeList
    readonly chats: StaffHomeList
    readonly shortcuts: StaffHomeList
}

/** What the home of the workspace is told: the shape it draws and the facts of each shape. */
export interface OverviewHomeBaseProps {
    readonly props: {
        /** Which home the one `Page` draws (a drawn shape, never a data status). */
        readonly shape: OverviewHomeShape
        readonly manager: OverviewManagerProps
        readonly staff: OverviewStaffProps
    }
    readonly on: {
        readonly setPeriod: (period: OverviewPeriod) => void
        readonly exportReport: () => void
        /** Opens a path inside the workspace (a row of the approvals card). */
        readonly openHref: (href: string) => void
        /** Opens an address that already names its workspace (a row of the staff home). */
        readonly open: (href: string) => void
        readonly openAgents: () => void
        readonly retry: () => void
    }
}
