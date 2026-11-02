import { AlertDialog, Button, Cluster, Link } from "@starci/grammar/common"
import type { RowActionView } from "@/modules/types"

/** The resolved commands of one row, part or list heading. */
interface KnowledgeRowActionsProps {
    readonly items: readonly RowActionView[]
    readonly isLoading?: boolean
    readonly isHeading?: boolean
    readonly onAction?: ((actionId: string) => void) | undefined
    readonly onConfirm?: ((actionId: string) => Promise<void> | undefined) | undefined
}

interface CommandProps {
    readonly item: RowActionView
    readonly isLoading: boolean
    readonly onAction: KnowledgeRowActionsProps["onAction"]
    readonly onConfirm: KnowledgeRowActionsProps["onConfirm"]
}

/** A destructive entry asks for its own authority and keeps the confirm pending through settlement. */
const Command = (props: CommandProps) => {
    const item = props.item
    if (item.intent === "destructive")
        return (
            <AlertDialog
                title={item.confirmation.title}
                description={item.confirmation.description}
                confirmLabel={item.confirmation.confirmLabel}
                cancelLabel={item.confirmation.cancelLabel}
                isConfirmPending={item.isPending ?? false}
                onConfirm={() =>
                    props.onConfirm?.(item.id) ??
                    Promise.reject(new Error("destructive action has no confirmation owner"))
                }
                trigger={
                    <Button
                        intent="destructive"
                        step="entry"
                        isLoading={props.isLoading}
                        isDisabled={item.isDisabled ?? false}
                        {...(item.disabledReason === undefined ? {} : { disabledReason: item.disabledReason })}
                    >
                        {item.label}
                    </Button>
                }
            />
        )
    return (
        <Button
            intent={item.intent ?? "neutral"}
            isPending={item.isPending ?? false}
            isLoading={props.isLoading}
            isDisabled={item.isDisabled ?? false}
            {...(item.disabledReason === undefined ? {} : { disabledReason: item.disabledReason })}
            onPress={() => props.onAction?.(item.id)}
        >
            {item.label}
        </Button>
    )
}

interface ItemProps extends CommandProps {
    readonly isHeading: boolean
}

/** Destinations retain their native link behavior and heading-button placement. */
const Item = (props: ItemProps) => {
    const item = props.item
    if (item.href === undefined)
        return <Command item={item} isLoading={props.isLoading} onAction={props.onAction} onConfirm={props.onConfirm} />
    if (props.isHeading)
        return (
            <Button intent="neutral" href={item.href} isLoading={props.isLoading}>
                {item.label}
            </Button>
        )
    return (
        <Link href={item.href} isDisabled={props.isLoading || item.isDisabled === true}>
            {item.label}
        </Link>
    )
}

/** Draws destinations as links and local decisions as real controls with their initiating pending state. */
export const KnowledgeRowActions = (props: KnowledgeRowActionsProps) =>
    props.items.length === 0 ? null : (
        <Cluster gap="inline" align="center">
            {props.items.map((item) => (
                <Item
                    key={item.id}
                    item={item}
                    isHeading={props.isHeading ?? false}
                    isLoading={props.isLoading ?? false}
                    onAction={props.onAction}
                    onConfirm={props.onConfirm}
                />
            ))}
        </Cluster>
    )
