import { AlertDialog, Badge, Button, Cluster, DropdownMenu, IconButton } from "@starci/grammar/common"
import { KnowledgeDocMark } from "@/components/composites/KnowledgeDocMark"
import { PaneHead } from "@/components/composites/PaneHead"
import { Icon, nivoIconSource } from "@/components/leaves/Icon"
import type { DocHeadView } from "@/modules/types"

/** What the head band of an opened document draws and calls. */
interface KnowledgeDocHeadProps {
    readonly head: DocHeadView
    readonly backLabel: string
    readonly moreLabel: string
    readonly isLoading: boolean
    readonly isRemoveOpen: boolean
    readonly onBack: () => void
    readonly onReindex: () => void
    readonly onMenu: (id: string) => void
    readonly onRemoveOpenChange: (isOpen: boolean) => void
    readonly onRemove: () => Promise<void>
}

/**
 * The head band over the opened document: its mark, name with where it stands and who may read it, one line of when and what, and
 * its commands: "read again" as the one neutral button and a "..." menu for the rest, where deleting asks to be confirmed. The base
 * knowledge has neither command, so its band is only the title and its "read only" chip.
 */
export const KnowledgeDocHead = (props: KnowledgeDocHeadProps) => {
    const { head } = props
    return (
        <>
            <PaneHead
                title={head.title}
                headingLevel={1}
                description={head.meta}
                mark={<KnowledgeDocMark glyph={head.glyph} />}
                status={
                    head.chips.length === 0 ? undefined : (
                        <Cluster gap="inline">
                            {head.chips.map((chip) => (
                                <Badge key={chip.label} tone={chip.tone}>
                                    {chip.label}
                                </Badge>
                            ))}
                        </Cluster>
                    )
                }
                back={{ label: props.backLabel, onPress: props.onBack }}
                isLoading={props.isLoading}
                actions={
                    <>
                        {head.reindex === null ? null : (
                            <Button
                                intent="neutral"
                                size="sm"
                                startContent={<Icon props={{ name: "retry", usage: "leading" }} />}
                                isPending={head.reindex.isPending}
                                isDisabled={head.reindex.isDisabled}
                                onPress={props.onReindex}
                            >
                                {head.reindex.label}
                            </Button>
                        )}
                        {head.menu.length === 0 ? null : (
                            <DropdownMenu
                                placement="bottom end"
                                entries={head.menu.map((item) => ({
                                    id: item.id,
                                    label: item.label,
                                    ...(item.tone === undefined ? {} : { tone: item.tone }),
                                    onAction: () => props.onMenu(item.id),
                                }))}
                                trigger={
                                    <IconButton
                                        intent="neutral"
                                        source={nivoIconSource("more", "leading")}
                                        label={props.moreLabel}
                                    />
                                }
                            />
                        )}
                    </>
                }
            />
            {head.remove === null ? null : (
                <AlertDialog
                    isOpen={props.isRemoveOpen}
                    onOpenChange={props.onRemoveOpenChange}
                    title={head.remove.title}
                    description={head.remove.description}
                    confirmLabel={head.remove.confirmLabel}
                    cancelLabel={head.remove.cancelLabel}
                    isConfirmPending={head.remove.isPending}
                    onConfirm={props.onRemove}
                />
            )}
        </>
    )
}
