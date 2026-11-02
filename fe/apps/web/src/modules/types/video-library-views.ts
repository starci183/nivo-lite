import type { BadgeTone } from "@starci/grammar/common"

interface VideoBrandOption {
    readonly id: string
    readonly label: string
}

interface VideoBrandSettingsFields {
    readonly title: string
    readonly hint: string
    readonly shopNameLabel: string
    readonly shopName: string
    readonly primaryLabel: string
    readonly primary: string
    readonly secondaryLabel: string
    readonly secondary: string
    readonly colorHint: string
    readonly logoLabel: string
    readonly logoUrl: string | null
    readonly logoNone: string
    readonly logoUpload: string
    readonly logoRemove: string
    readonly hasLogo: boolean
    readonly musicLabel: string
    readonly music: string
    readonly musics: ReadonlyArray<VideoBrandOption>
    readonly voiceLabel: string
    readonly voice: string
    readonly voices: ReadonlyArray<VideoBrandOption>
    readonly saveLabel: string
    readonly canEdit: boolean
    readonly pending: boolean
    readonly message: { readonly tone: "affirmative" | "negative"; readonly text: string } | null
}

interface VideoBrandSettingsActions {
    readonly shopName: (value: string) => void
    readonly primary: (value: string) => void
    readonly secondary: (value: string) => void
    readonly logoFiles: (files: ReadonlyArray<File>) => void
    readonly logoRemove: () => void
    readonly music: (value: string | null) => void
    readonly voice: (value: string | null) => void
    readonly save: () => void
}

interface VideoLibraryEntry {
    readonly id: string
    readonly title: string
    readonly posterUrl: string | null
    readonly noPoster: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly goalLabel: string
    readonly aspectLabel: string
    readonly facts: string
    readonly href: string
    readonly archiveDisabled: boolean
}

interface VideoLibraryListFields {
    readonly title: string
    readonly meta: string
    readonly entries: ReadonlyArray<VideoLibraryEntry>
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly newLabel: string
    readonly openLabel: string
    readonly menuLabel: string
    readonly duplicateLabel: string
    readonly archiveLabel: string
    readonly viewOnly: string | null
    readonly error: string | null
    readonly dismissLabel: string
    readonly canEdit: boolean
    readonly busy: boolean
}

interface VideoLibraryListActions {
    readonly create: () => void
    readonly duplicate: (id: string) => void
    readonly archive: (id: string) => void
    readonly dismissError: () => void
}

/** Resolved brand and library drawing fields. */
export interface VideoLibraryViews {
    readonly brand: VideoBrandSettingsFields
    readonly library: VideoLibraryListFields
}

/** Commands initiated by brand and library drawings. */
export interface VideoLibraryActions {
    readonly brand: VideoBrandSettingsActions
    readonly library: VideoLibraryListActions
}
