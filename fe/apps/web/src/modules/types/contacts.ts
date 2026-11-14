import type { ReactNode } from "react"
import type { ChatMessageFile } from "./chatbot-inbox"
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
    /** The name of the connection a channel identity lives on ("Flower shop"); null when the app does not know it. */
    readonly account: (connectionId: string) => string | null
    /** The label of how a piece of work ended ("Done", "Failed", "Passed over"); null for a status the app has no word for. */
    readonly noteStatus: (status: string) => string | null
    /** What a piece of work is called when the back end names neither its workflow nor its step. */
    readonly noteUnknownWork: string
    /** "round 2": which turn of a repeated step a row is. */
    readonly noteRound: (round: number) => string
    /** "Held by An": the staff hold the conversation; the name is null when the seat is gone. */
    readonly hold: (name: string | null) => string
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

/** One way to reach the person, with why it is on this person. */
export interface ContactIdentityView {
    readonly id: string
    /** "Zalo · Flower shop" for a channel, else the kind ("Phone"). */
    readonly title: string
    /** The phone or the mail; null for a channel (its own id is no one's business). */
    readonly description: string | null
    /** The mark of the channel, when the app has one. */
    readonly logo: string | null
    /** Why it is linked ("vouched by the channel", "same phone"); null when nothing is known. */
    readonly why: string | null
    /** "Held by An": the staff hold the conversation on this channel account; null when the agents speak on it. */
    readonly hold: string | null
}

/** One fact the agents remember about the person. */
export interface ContactFactView {
    readonly name: string
    readonly value: string
}

/** One piece of work the agents did: which work it was, how it ended (a label in the workspace language) and when. */
export interface ContactNoteView {
    readonly id: string
    /** The workflow's label, and the step's when the app has one ("Sales · Consult"); never a key. */
    readonly title: string
    /** How the step ended, as a label ("Done"); null for a status the app has no word for. */
    readonly status: string | null
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

/** One tab of the conversation block: every channel, or one channel the person is on. */
export interface ContactHistoryTabView {
    readonly key: string
    readonly label: string
}

/** Who said a line: the person, an agent, or a member of the shop. */
export type ContactHistoryVoice = "person" | "agent" | "staff"

/** The words an order card of a line is labelled with. */
export interface ContactHistoryOrderWords {
    /** The label of the total. */
    readonly total: string
    /** The label of the delivery line. */
    readonly deliver: string
    /** The mark of an order that was paid. */
    readonly paid: string
    /** The mark of an order that waits for its payment. */
    readonly pending: string
}

/** The order a line told, as the sender snapshotted it: its number, whether it was paid, and the body the app draws an order with (items, total, delivery). */
export interface ContactHistoryOrderView {
    readonly orderNo: string
    /** The mark of the order: paid, or waiting for its payment. */
    readonly status: { readonly label: string; readonly isPaid: boolean }
    /** The body of the order (the registered order view's own drawing); null when the registry has none. */
    readonly body: ReactNode
}

/** One line of the conversation: who said it, when, the words and the files. */
export interface ContactHistoryLineView {
    readonly id: string
    readonly voice: ContactHistoryVoice
    /** "Customer", "Lan (agent)" or "An (staff)": the caption above the bubble. */
    readonly author: string
    /** The time of day. */
    readonly time: string
    readonly text: string
    readonly files: ReadonlyArray<ChatMessageFile>
    /** The order card the line carries; null when it told none or its snapshot does not read. */
    readonly order: ContactHistoryOrderView | null
    /** The day separator drawn before the line ("Today · Zalo"); null when the line shares the one before. */
    readonly separator: string | null
}

/** The lines of the conversation read so far (oldest first) and whether older ones wait. */
export interface ContactHistoryThread {
    readonly lines: ReadonlyArray<ContactHistoryLineView>
    /** Older lines exist on a route of the tab. */
    readonly hasOlder: boolean
    readonly isLoadingOlder: boolean
}

/** What the conversation block of a person draws: its tabs, where the workbench is, and the thread as one data slot. */
export interface ContactHistoryView {
    readonly tabs: ReadonlyArray<ContactHistoryTabView>
    readonly selectedKey: string
    /** The workbench of the agent that spoke last on the route the tab shows (on every channel: the most recently active route); null when no agent has spoken. */
    readonly workbenchHref: string | null
    /** The thread: loading, failed, nothing said yet, or the lines. */
    readonly thread: DataSlot<ContactHistoryThread>
}

/** The words the conversation lines are worded with, resolved once by the connected half. */
export interface ContactHistoryWords {
    readonly person: string
    /** "Lan (agent)" for the agent that told a line (null: the server names none). */
    readonly agent: (name: string | null) => string
    /** "An (staff)" for the member who typed a line (null: the seat is gone). */
    readonly staff: (name: string | null) => string
    /** "Today", "Yesterday" or the date, then the channel when the tab is every channel. */
    readonly day: (iso: string, channel: string | null) => string
    /** The time of day of a line. */
    readonly time: (iso: string) => string
    /** The order card of a line's `orderJson` text; null when the text is no order (the line then shows its words alone). */
    readonly order: (orderJson: string | null) => ContactHistoryOrderView | null
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
    readonly channelsLabel: string
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
    readonly noWayLine: string
    readonly rowMenuLabel: string
    readonly unlinkLabel: string
    readonly linkIdentityLabel: string
    readonly mergeLabel: string
    readonly deleteLabel: string
    readonly memoryTitle: string
    readonly memoryEmpty: string
    readonly forgetLabel: string
    readonly notesTitle: string
    readonly historyTitle: string
    readonly historyTabsLabel: string
    readonly historyTabAll: string
    readonly historyWorkbench: string
    readonly historyFooter: string
    readonly historyOlder: string
    readonly modulesTitle: string
    readonly modulesNote: string
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
        readonly historyLabels: SlotLabels
        /** The conversation of the open person across every channel; null while the address names none. */
        readonly history: ContactHistoryView | null
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
        /** Narrows the conversation to one channel, or back to every channel. */
        readonly selectHistoryTab: (key: string) => void
        readonly historyOlder: () => void
        readonly retryHistory: () => void
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
