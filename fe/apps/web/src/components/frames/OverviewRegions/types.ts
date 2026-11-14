import type { OverviewView } from "@/modules/types"

/** The words of the regions of the owner's overview, resolved by the connected block. */
export interface OverviewRegionsCopy {
    readonly kpisLabel: string
    readonly approvals: {
        readonly title: string
        readonly more: string
        readonly emptyTitle: string
        readonly emptyBody: string
    }
    readonly savings: { readonly title: string; readonly hoursNote: string; readonly help: string }
    readonly agents: {
        readonly title: string
        readonly note: string
        readonly open: string
        readonly agent: string
        readonly tasks: string
        readonly auto: string
        readonly waiting: string
        readonly errors: string
        readonly response: string
        readonly saved: string
        readonly credits: string
        readonly emptyTitle: string
        readonly emptyBody: string
    }
}

/** What the regions are told: the figures, whether they are a placeholder, the words, and the places they lead to. */
export interface OverviewRegionsProps {
    readonly props: {
        readonly view: OverviewView
        readonly isLoading: boolean
        readonly copy: OverviewRegionsCopy
        /** A phone's screen: what needs the owner comes first. */
        readonly isPhone: boolean
        /** Where the head links of the regions lead: the team chat and the agents. */
        readonly chatHref: string
        readonly agentsHref: string
    }
    readonly on: {
        readonly openHref: (href: string) => void
    }
}
