/** Server-resolved words and destinations of the Second Brain page heading. */
export interface BrainPageHeading {
    readonly title: string
    readonly description: string
    readonly breadcrumbs: {
        readonly label: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
    }
}

/** Resolved header data; the Page owner builds its native controls and callbacks. */
export interface BrainPageHeaderView {
    readonly heading: BrainPageHeading
    readonly tabs: {
        readonly label: string
        readonly selectedKey: string
        readonly panelPrefix: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string }>
    }
    readonly actions: {
        readonly part: {
            readonly label: string
            readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
            readonly value: string
        }
        readonly review: {
            readonly label: string
            readonly isRunning: boolean
            readonly isPending: boolean
            readonly runningLabel: string
        } | null
        readonly add: { readonly label: string; readonly href: string } | null
    }
}
