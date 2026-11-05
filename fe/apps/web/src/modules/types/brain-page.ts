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
            /** The label of the options menu that holds the review command. */
            readonly menuLabel: string
            readonly label: string
            readonly isRunning: boolean
            readonly isPending: boolean
            readonly runningLabel: string
        } | null
        readonly add: { readonly label: string; readonly href: string } | null
    }
}

/** One choice of a select, a radio group or a check group. */
interface FactChoiceView {
    readonly id: string
    readonly label: string
}

/** The drawer that writes a fact, or a new value for one in force: its words, its values and what it does. */
export interface FactDrawerView {
    readonly props: {
        readonly title: string
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly saveLabel: string
        readonly failTitle: string
        readonly isOpen: boolean
        readonly isPending: boolean
        /** The customer question the fact answers, kept in view while it is written. */
        readonly question?: string | undefined
        readonly typeLabel: string
        readonly selectPlaceholder: string
        readonly typeOptions: ReadonlyArray<FactChoiceView>
        readonly subjectLabel: string
        readonly subjectHint: string
        readonly attributeLabel: string
        readonly attributeHint: string
        readonly valueLabel: string
        readonly scopeLabel: string
        readonly scopeOptions: ReadonlyArray<FactChoiceView>
        readonly modulesLabel: string
        readonly moduleOptions: ReadonlyArray<FactChoiceView>
        readonly fromLabel: string
        readonly toLabel: string
        readonly noteLabel: string
        readonly subjectType: string
        readonly subject: string
        readonly attribute: string
        readonly value: string
        readonly scope: string
        readonly modules: ReadonlyArray<string>
        readonly validFrom: string
        readonly validTo: string
        readonly note: string
        readonly error?: string
    }
    readonly on: {
        readonly close: () => void
        readonly submit: () => void
        readonly setType: (value: string | null) => void
        readonly setSubject: (value: string) => void
        readonly setAttribute: (value: string) => void
        readonly setValue: (value: string) => void
        readonly setScope: (value: string) => void
        readonly setModules: (value: ReadonlyArray<string>) => void
        readonly setFrom: (value: string) => void
        readonly setTo: (value: string) => void
        readonly setNote: (value: string) => void
    }
}
