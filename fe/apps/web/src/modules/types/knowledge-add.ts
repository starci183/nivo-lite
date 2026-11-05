import type { BatchBytesView, LinkRowView, QueueRowView, StoppedUploadsView } from "./knowledge"

/** One question and its answer. */
interface AddPairView {
    readonly id: string
    readonly q: string
    readonly a: string
}

/** One choice of a select or a chip group. */
interface AddChoiceView {
    readonly id: string
    readonly label: string
}

/** The words and values of the files and links panel. */
interface AddFilesView {
    readonly dropPrompt: string
    readonly dropHint: string
    readonly linksLabel: string
    readonly linksHint: string
    readonly linkPlaceholder: string
    readonly linkRemoveLabel: string
    readonly addLinkLabel: string
    readonly queueTitle: string
    readonly removeLabel: string
    readonly links: ReadonlyArray<LinkRowView>
    readonly queue: ReadonlyArray<QueueRowView>
    readonly batch?: BatchBytesView | undefined
    readonly stopped?: StoppedUploadsView | undefined
    readonly note?: string | undefined
}

/** The words and values of the panel that writes a note, or a list of questions when pairs are set. */
interface AddNoteView {
    readonly titleLabel: string
    readonly titleHint: string
    readonly contentLabel: string
    readonly contentHint: string
    readonly questionLabel: string
    readonly answerLabel: string
    readonly addLabel: string
    readonly removeLabel: string
    readonly title: string
    readonly content: string
    readonly pairs?: ReadonlyArray<AddPairView> | undefined
    readonly titleError?: string | undefined
    readonly contentError?: string | undefined
}

/** The words and values of the options of the batch. */
interface AddOptionsView {
    readonly title: string
    readonly topicLabel: string
    readonly topicHint: string
    readonly tagsLabel: string
    readonly tagsHint: string
    readonly moduleLabel: string
    readonly topic: string
    readonly tags: string
    readonly module: string
    readonly moduleOptions: ReadonlyArray<AddChoiceView>
    /** The muted line at the end of the options' trigger: what the batch is filed under now. */
    readonly summary: string
}

/** The raw document allowance as the meter draws it. */
interface AddUsageView {
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly tone: "affirmative" | "cautionary" | "negative"
}

/** The Google Drive way in: the button for where the grant stands, and its words. */
interface AddDriveView {
    readonly label: string | undefined
    readonly note?: string | undefined
    readonly trouble?: string | undefined
}

/** What follows a finished batch: how many questions NIVO now has for the owner, and the way to them. */
interface AddSummaryView {
    readonly title: string
    readonly actionLabel: string
}

/** Copy, values and state the connected drawer supplies. */
export interface KnowledgeAddDrawerView {
    readonly props: {
        /** Set when the member may only read: the words replace the form. */
        readonly readOnlyNote?: string | undefined
        readonly drive: AddDriveView
        readonly isOpen: boolean
        readonly closeLabel: string
        readonly cancelLabel: string
        readonly title: string
        readonly submitLabel: string
        readonly emptyQueueLabel: string
        readonly failTitle: string
        readonly isBusy: boolean
        readonly modeLabel: string
        readonly modeOptions: ReadonlyArray<AddChoiceView>
        readonly mode: string
        readonly files: AddFilesView
        readonly note: AddNoteView
        /** Says that what is added here is internal: customers and the chatbot cannot read it. */
        readonly internalNote: string
        readonly summary: AddSummaryView | null
        /** How much of the raw document allowance is used; nothing is drawn for it while undefined. */
        readonly usage: AddUsageView | undefined
        readonly options: AddOptionsView
        readonly notice?: string | undefined
        readonly error?: string | undefined
    }
    readonly on: {
        readonly close: () => void
        readonly connectDrive: () => void
        readonly seeQuestions: () => void
        readonly setMode: (value: string) => void
        readonly addFiles: (files: Array<File>) => void
        readonly setLink: (id: string, value: string) => void
        readonly checkLink: (id: string) => void
        readonly addLink: () => void
        readonly removeLink: (id: string) => void
        readonly removeItem: (id: string) => void
        readonly retryItem: (id: string) => void
        readonly dismissStopped: () => void
        readonly setTitle: (value: string) => void
        readonly setContent: (value: string) => void
        readonly setPair: (id: string, field: "q" | "a", value: string) => void
        readonly addPair: () => void
        readonly removePair: (id: string) => void
        readonly setTopic: (value: string) => void
        readonly setTags: (value: string) => void
        readonly setModule: (value: string | null) => void
        readonly submit: () => void
    }
}
