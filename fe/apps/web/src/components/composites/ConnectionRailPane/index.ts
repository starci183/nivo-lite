/** The rail of a provider page as the props of its `Pane`: a pane beside the main one that becomes a drawer, with its own open and close buttons. */
interface RailPaneView {
    readonly label: string
    readonly openLabel: string
    readonly closeLabel: string
    readonly isOpen: boolean
}

/**
 * The drawer props of the rail `Pane`. A `PaneGrid` reads its panes' own props to place their drawers, so the `Pane` stays a literal child
 * of the grid and only these props are shared.
 */
export const railPaneProps = (rail: RailPaneView, onOpenChange: (isOpen: boolean) => void) => ({
    label: rail.label,
    collapse: "drawer" as const,
    collapseLabel: rail.label,
    openLabel: rail.openLabel,
    closeLabel: rail.closeLabel,
    isOpen: rail.isOpen,
    onOpenChange,
})
