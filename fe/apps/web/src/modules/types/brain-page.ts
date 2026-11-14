/** Server-resolved words and destinations of the Second Brain page heading. */
export interface BrainPageHeading {
    readonly title: string
    readonly description: string
    readonly breadcrumbs: {
        readonly label: string
        readonly items: ReadonlyArray<{ readonly id: string; readonly label: string; readonly href?: string }>
    }
}

/** One tab of the header strip or one chip of the knowledge tab: its words, its count, and whether the count waits for the owner. */
export interface BrainTabItemView {
    readonly id: string
    readonly label: string
    readonly count?: number
    readonly isAttention?: boolean
}

/** The chips of the knowledge tab: the documents, the facts and the lessons, each a link to its page. */
export interface BrainChipsView {
    readonly label: string
    readonly selectedKey: string
    readonly items: ReadonlyArray<BrainTabItemView & { readonly href: string }>
}

/** Resolved header data; the Page owner builds its native controls and callbacks. */
export interface BrainPageHeaderView {
    readonly heading: BrainPageHeading
    readonly tabs: {
        readonly label: string
        readonly selectedKey: string
        readonly panelPrefix: string
        /** The id of the panel the selected tab shows: one panel is swapped by every tab. */
        readonly panelId: string
        readonly items: ReadonlyArray<BrainTabItemView>
    }
    /** The chips under the knowledge tab; null on every other tab. */
    readonly chips: BrainChipsView | null
    readonly actions: {
        readonly part: {
            readonly label: string
            readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
            readonly value: string
        }
        /** The way to add documents; disabled while the documents limit is used up. */
        readonly add: { readonly label: string; readonly href: string; readonly isDisabled?: boolean } | null
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
        /** The fact being given a new value and the value in force, kept in view while the new one is written. */
        readonly context?: string | undefined
        /** The drawer gives a new value to a fact in force: what the fact is about is fixed, so its fields are not asked. */
        readonly isEditing: boolean
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
        readonly scopeHint: string
        readonly modulesLabel: string
        readonly moduleOptions: ReadonlyArray<FactChoiceView>
        readonly fromLabel: string
        readonly toLabel: string
        readonly noteLabel: string
        readonly toPlaceholder: string
        readonly notePlaceholder: string
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
