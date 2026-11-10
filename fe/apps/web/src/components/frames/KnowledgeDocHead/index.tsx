import { AlertDialog, Badge, Button, Cluster, DropdownMenu, IconButton } from "@starci/grammar/common"
import { KnowledgeDocMark } from "@/components/composites/KnowledgeDocMark"
import { PaneHead } from "@/components/composites/PaneHead"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { DocHeadView } from "@/modules/types"
import { WIDE_ONLY_CLASS_NAME } from "./classNames"

/** What the head band of an opened document draws and calls. */
interface KnowledgeDocHeadProps {
    readonly head: DocHeadView
    readonly backLabel: string
    readonly moreLabel: string
    /** The name of the control that opens the details on a phone; null where the screen has no details pane. */
    readonly detailsLabel: string | null
    readonly isLoading: boolean
    readonly isRemoveOpen: boolean
    readonly onBack: () => void
    readonly onReindex: () => void
    readonly onMenu: (id: string) => void
    readonly onRemoveOpenChange: (isOpen: boolean) => void
    readonly onRemove: () => Promise<void>
}

/** What the "..." menu of the head draws and calls. */
interface HeadMenuProps {
    readonly head: DocHeadView
    readonly moreLabel: string
    readonly onMenu: (id: string) => void
}

/** The "..." menu of the head: the commands behind it; none, no menu. */
const HeadMenu = (props: HeadMenuProps) =>
    props.head.menu.length === 0 ? null : (
        <DropdownMenu
            placement="bottom end"
            entries={props.head.menu.map((item) => ({
                id: item.id,
                label: item.label,
                ...(item.tone === undefined ? {} : { tone: item.tone }),
                onAction: () => props.onMenu(item.id),
            }))}
            trigger={<IconButton intent="neutral" source={nivoIconSource("more", "leading")} label={props.moreLabel} />}
        />
    )

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
                        <div className={WIDE_ONLY_CLASS_NAME}>
                            <Cluster gap="inline">
                                {head.chips.map((chip) => (
                                    <Badge key={chip.label} tone={chip.tone}>
                                        {chip.label}
                                    </Badge>
                                ))}
                            </Cluster>
                        </div>
                    )
                }
                {...(props.detailsLabel === null
                    ? {}
                    : {
                          drawerOpener: {
                              pane: "aside",
                              icon: nivoIconSource("info", "leading"),
                              label: props.detailsLabel,
                          },
                      })}
                back={{ label: props.backLabel, onPress: props.onBack }}
                isLoading={props.isLoading}
                actions={
                    <>
                        {head.reindex === null ? null : (
                            <div className={WIDE_ONLY_CLASS_NAME}>
                                <Button
                                    intent="neutral"
                                    size="sm"
                                    isPending={head.reindex.isPending}
                                    isDisabled={head.reindex.isDisabled}
                                    onPress={props.onReindex}
                                >
                                    {head.reindex.label}
                                </Button>
                            </div>
                        )}
                        <HeadMenu head={head} moreLabel={props.moreLabel} onMenu={props.onMenu} />
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
