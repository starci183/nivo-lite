import type { ComponentProps, ReactElement } from "react"
import { EmptyNotice, PaneSection } from "@starci/grammar/common"
import type { PageHeaderContent, PaneGrid } from "@starci/grammar/common"
import type { ConnectionRefusalView } from "@/modules/types"

/** What the live rail pane of a provider connection page says and whether its drawer is open. */
interface ConnectionRail {
    readonly label: string
    readonly openLabel: string
    readonly closeLabel: string
    readonly isOpen: boolean
}

type GridAreas = ComponentProps<typeof PaneGrid>["areas"]
type GridColumns = NonNullable<ComponentProps<typeof PaneGrid>["columns"]>

/** The main pane alone for a member who may not read the page, the main pane beside the live rail otherwise. */
const connectionAreasOf = (isRefused: boolean): GridAreas =>
    isRefused ? { base: ["main"], medium: ["main"] } : { base: ["main"], medium: ["main rail"] }

/** The tracks of {@link connectionAreasOf}. */
const connectionColumnsOf = (isRefused: boolean): GridColumns =>
    isRefused ? { base: ["fill"], medium: ["fill"] } : { base: ["fill"], medium: ["fill", "standard"] }

/** The areas and the tracks of the pane grid of a provider connection page. */
export const connectionGridOf = (isRefused: boolean): { readonly areas: GridAreas; readonly columns: GridColumns } => ({
    areas: connectionAreasOf(isRefused),
    columns: connectionColumnsOf(isRefused),
})

/** The live rail pane of a provider page as the pane grid takes it: a drawer on a narrow screen. */
interface ConnectionRailPane extends ConnectionRail {
    readonly collapse: "drawer"
    readonly collapseLabel: string
    readonly onOpenChange: (isOpen: boolean) => void
}

/** The live rail pane of a provider page, which becomes a drawer on a narrow screen. */
export const connectionRailPaneOf = (
    rail: ConnectionRail,
    onOpenChange: (isOpen: boolean) => void,
): ConnectionRailPane => ({
    label: rail.label,
    collapse: "drawer" as const,
    collapseLabel: rail.label,
    openLabel: rail.openLabel,
    closeLabel: rail.closeLabel,
    isOpen: rail.isOpen,
    onOpenChange,
})

/** The header of a member who may not read a provider page: the trail home and the title. */
export const connectionRefusedHeaderOf = (refusal: ConnectionRefusalView): PageHeaderContent => ({
    title: refusal.title,
    breadcrumbs: {
        label: refusal.crumbLabel,
        items: [
            { id: "home", label: refusal.homeLabel, href: refusal.homeHref },
            { id: "connections", label: refusal.title },
        ],
    },
})

/** Why the member may not read the page. */
interface ConnectionPaneLayoutNoticeProps {
    readonly refusal: ConnectionRefusalView | undefined
}

/** What the main pane of a provider page opens with for a member who may not read it, and nothing for anyone else. */
export const ConnectionPaneLayoutNotice = (props: ConnectionPaneLayoutNoticeProps): ReactElement | null =>
    props.refusal === undefined ? null : (
        <PaneSection>
            <EmptyNotice message={props.refusal.message} description={props.refusal.description} />
        </PaneSection>
    )
