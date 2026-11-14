import type { DataSlot, SlotLabels } from "./slot"

/** The words a person's data is worded with, resolved once by the connected half (the mapping below it holds no copy). */
export interface ContactWords {
    /** The name of a person nobody named, by the channel they came on ("Facebook guest") (null: no channel is known). */
    readonly unknownPerson: (brand: string | null) => string
    /** "2 minutes ago": when something happened, for an ISO moment. */
    readonly ago: (iso: string) => string
    readonly kindPhone: string
    readonly kindEmail: string
    readonly kindChannel: string
    readonly kindExternal: string
    /** How an identity is proven, in words. */
    readonly proof: Readonly<Record<"channel" | "token" | "member" | "claimed" | "verified", string>>
    /** Why an identity came to a person by a merge, in words. */
    readonly reason: Readonly<Record<"phone_verified" | "email_verified" | "link_token" | "member_approved", string>>
    readonly whyClaimed: string
    readonly whySameName: string
}

/** One channel a person is reached on: its name and its mark. */
export interface ContactChannelView {
    readonly name: string
    /** The mark of the channel; null when the app has none (the name is drawn instead). */
    readonly logo: string | null
}

/** One row of the people list: the name, when and where the person was last seen. */
export interface ContactListRowView {
    readonly id: string
    readonly name: string
    /** "2 minutes ago": when the person was last active. */
    readonly time: string
    /** The channels the person is reached on, each with its mark when the app has one. */
    readonly channels: ReadonlyArray<ContactChannelView>
    /** Nobody knows the name: the avatar shows "?". */
    readonly isUnknown: boolean
}

/** The people the list holds and whether the back end has more after them. */
export interface ContactsListData {
    readonly rows: ReadonlyArray<ContactListRowView>
    readonly hasMore: boolean
}

/** One way to reach the person, with how it is proven and why it is on this person. */
export interface ContactIdentityView {
    readonly id: string
    readonly title: string
    readonly value: string
    readonly proof: string
    /** The mark of the channel, when the app has one. */
    readonly logo: string | null
    /** The merge reason ("same phone"); null for an identity the person was met with. */
    readonly reason: string | null
}

/** One fact the agents remember about the person. */
export interface ContactFactView {
    readonly name: string
    readonly value: string
}

/** One step outcome the agents remember. */
export interface ContactNoteView {
    readonly id: string
    readonly title: string
    readonly text: string
    readonly time: string
}

/** One person who may be the same as the one open. */
export interface ContactSuggestionView {
    readonly contactId: string
    readonly name: string
    readonly why: string
}

/** The person that is open, worded. */
export interface ContactDetailView {
    readonly id: string
    readonly name: string
    readonly initial: string
    /** "0901 234 567 · lan@gmail.com". */
    readonly line: string
    /** The stored name, empty when nobody named the person: the edit form starts from it. */
    readonly displayName: string
    readonly tags: ReadonlyArray<string>
    readonly identities: ReadonlyArray<ContactIdentityView>
    readonly facts: ReadonlyArray<ContactFactView>
    readonly notes: ReadonlyArray<ContactNoteView>
    readonly suggestions: ReadonlyArray<ContactSuggestionView>
    /** The viewer is the owner: only an owner deletes a person. */
    readonly canDelete: boolean
}

/** One block an agent's module mounts on the person: its title, the generic block as a spec node and what its read gave, both JSON text. */
export interface ContactModuleBlockView {
    readonly id: string
    readonly title: string
    readonly nodeJson: string
    readonly dataJson: string
    readonly count: number
}

/** What one installed agent knows about the person: its name, how many rows its blocks hold and the blocks themselves. */
export interface ContactModuleAgentView {
    readonly installationId: string
    readonly moduleKey: string
    readonly name: string
    /** The rows of every block of the agent (the first rows only). */
    readonly count: number
    /** Some block holds more rows than it shows. */
    readonly hasMore: boolean
    readonly blocks: ReadonlyArray<ContactModuleBlockView>
}

/** The words of the edit drawer. */
interface ContactEditCopy {
    readonly title: string
    readonly nameLabel: string
    readonly tagsLabel: string
    readonly tagsHint: string
    readonly submitLabel: string
    readonly failTitle: string
}

/** The words of the link drawer. */
interface ContactLinkCopy {
    readonly title: string
    readonly kindLabel: string
    readonly kindPhone: string
    readonly kindEmail: string
    readonly valueLabel: string
    readonly hint: string
    readonly submitLabel: string
    readonly failTitle: string
}

/** The words of the merge drawer. */
interface ContactMergeCopy {
    readonly title: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly emptyTitle: string
    readonly submitLabel: string
}

/** Every word the contacts page draws. */
export interface ContactsPanesCopy {
    readonly title: string
    readonly description: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly listTitle: string
    readonly listLabel: string
    readonly moreLabel: string
    readonly emptyBody: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly forbiddenTitle: string
    readonly forbiddenBody: string
    readonly forbiddenAction: string
    readonly goneTitle: string
    readonly goneBody: string
    readonly goneAction: string
    readonly errorBody: string
    readonly cancelLabel: string
    readonly editLabel: string
    readonly rowMenuLabel: string
    readonly unlinkLabel: string
    readonly linkIdentityLabel: string
    readonly mergeLabel: string
    readonly deleteLabel: string
    readonly memoryTitle: string
    readonly memoryEmpty: string
    readonly forgetLabel: string
    readonly notesTitle: string
    readonly modulesTitle: string
    readonly modulesNote: string
    readonly modulesEmptyTitle: string
    readonly modulesEmptyBody: string
    readonly modulesMore: string
    readonly suggestionsTitle: string
    readonly suggestionViewLabel: string
    readonly suggestionMergeLabel: string
    readonly suggestionDismissLabel: string
    readonly edit: ContactEditCopy
    readonly link: ContactLinkCopy
    readonly merge: ContactMergeCopy
}

/** The edit drawer: the person's name and tags as a form sees them. */
export interface ContactEditView {
    readonly isOpen: boolean
    readonly name: string
    readonly tags: string
    readonly isPending: boolean
    readonly error: string | undefined
}

/** The link drawer: which kind of identity and its value. */
export interface ContactLinkView {
    readonly isOpen: boolean
    readonly kind: string
    readonly value: string
    readonly isPending: boolean
    readonly error: string | undefined
}

/** The merge drawer: the people one may be merged into and the one chosen. */
export interface ContactMergeView {
    readonly isOpen: boolean
    readonly hint: string
    readonly query: string
    readonly choices: ReadonlyArray<{ readonly id: string; readonly title: string; readonly subtitle: string }>
    readonly chosenId: string | null
    readonly isLoading: boolean
}

/** A question asked before something that cannot be undone. */
export interface ContactConfirmView {
    readonly title: string
    readonly description: string
    readonly confirmLabel: string
    /** `danger` for a change that erases or merges people; `neutral` for the rest. Chosen by the one who asks, never from words. */
    readonly kind: "danger" | "neutral"
    readonly isPending: boolean
}

/** What the contacts page draws, from one connected half. */
export interface ContactsPanesBaseProps {
    readonly props: {
        readonly copy: ContactsPanesCopy
        /** Owner and manager read the page; staff are told so. */
        readonly access: "manager" | "staff"
        readonly list: DataSlot<ContactsListData>
        readonly listLabels: SlotLabels
        /** The person that is open; null while the address names none. */
        readonly detail: DataSlot<ContactDetailView> | null
        readonly detailLabels: SlotLabels
        /** What each installed agent's module knows about the open person; null while the address names none. */
        readonly modules: DataSlot<ReadonlyArray<ContactModuleAgentView>> | null
        readonly modulesLabels: SlotLabels
        readonly selectedId: string | null
        readonly query: string
        readonly edit: ContactEditView
        readonly link: ContactLinkView
        readonly merge: ContactMergeView
        readonly confirm: ContactConfirmView | undefined
        /** A write is in flight. */
        readonly isPending: boolean
    }
    readonly on: {
        readonly setQuery: (value: string) => void
        readonly retryList: () => void
        readonly retryDetail: () => void
        readonly retryModules: () => void
        readonly select: (id: string) => void
        readonly loadMore: () => void
        readonly goHome: () => void
        readonly goList: () => void
        readonly openEdit: () => void
        readonly closeEdit: () => void
        readonly setEditName: (value: string) => void
        readonly setEditTags: (value: string) => void
        readonly submitEdit: () => void
        readonly openLink: () => void
        readonly closeLink: () => void
        readonly setLinkKind: (value: string) => void
        readonly setLinkValue: (value: string) => void
        readonly submitLink: () => void
        readonly openMerge: () => void
        readonly closeMerge: () => void
        readonly setMergeQuery: (value: string) => void
        readonly chooseMerge: (id: string) => void
        readonly submitMerge: () => void
        readonly askUnlink: (identityId: string) => void
        readonly askDelete: () => void
        readonly askMergeSuggestion: (contactId: string) => void
        readonly dismissSuggestion: (contactId: string) => void
        readonly forget: (name: string) => void
        readonly acceptConfirm: () => void
        readonly cancelConfirm: () => void
    }
}
