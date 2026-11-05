import { AlertDialog, Badge, DropdownMenu, IconButton } from "@starci/grammar/common"
import { KnowledgeDocMark } from "@/components/composites/KnowledgeDocMark"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { PublicBrainCopy, PublicDraftView } from "@/modules/types"

/** What the head band over the open public document draws and calls. */
interface PublicDraftHeadProps {
    readonly draft: PublicDraftView
    readonly copy: PublicBrainCopy
    readonly isLoading: boolean
    /** The owner may archive: the "..." menu is drawn. */
    readonly canWrite: boolean
    readonly isRemoveOpen: boolean
    readonly isRemoving: boolean
    readonly onBack: () => void
    readonly onMenu: (id: string) => void
    readonly onRemoveOpenChange: (isOpen: boolean) => void
    readonly onRemove: () => Promise<void>
}

/**
 * The head band over the open public document: the mark, the title with where it stands, one line of what it was drafted from, and a
 * "..." menu where archiving asks to be confirmed. The details opener sits in the head of a phone, where the questions are a drawer.
 */
export const PublicDraftHead = (props: PublicDraftHeadProps) => {
    const { draft, copy } = props
    return (
        <>
            <PaneHead
                title={draft.title}
                headingLevel={1}
                description={draft.meta}
                mark={<KnowledgeDocMark glyph="public" />}
                status={<Badge tone={draft.badge.tone}>{draft.badge.label}</Badge>}
                back={{ label: copy.back, onPress: props.onBack }}
                drawerOpener={{ pane: "aside", icon: nivoIconSource("chat", "leading"), label: copy.asideTitle }}
                isLoading={props.isLoading}
                actions={
                    props.canWrite ? (
                        <DropdownMenu
                            placement="bottom end"
                            entries={[
                                {
                                    id: "archive",
                                    label: copy.archiveLabel,
                                    tone: "danger",
                                    onAction: () => props.onMenu("archive"),
                                },
                            ]}
                            trigger={
                                <IconButton
                                    intent="neutral"
                                    source={nivoIconSource("more", "leading")}
                                    label={copy.moreActions}
                                />
                            }
                        />
                    ) : undefined
                }
            />
            <AlertDialog
                isOpen={props.isRemoveOpen}
                onOpenChange={props.onRemoveOpenChange}
                title={copy.archiveTitle(draft.title)}
                description={copy.archiveBody}
                confirmLabel={copy.archiveLabel}
                cancelLabel={copy.cancelLabel}
                isConfirmPending={props.isRemoving}
                onConfirm={props.onRemove}
            />
        </>
    )
}
