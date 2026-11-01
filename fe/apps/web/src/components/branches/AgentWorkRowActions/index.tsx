import { Button, DropdownMenu, IconButton } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"

/** The one command a row offers a person who may run it. */
interface AgentWorkRowCommand {
    readonly label: string
    readonly onPress: () => void
}

/** The ways a row can be acted on: the record it opened, and one command. */
interface AgentWorkRowActionsProps {
    /** The record the row opened; none when it opened none. */
    readonly link: { readonly label: string; readonly href: string } | null
    /** The command on the row; none for a person who may not run it. */
    readonly command: AgentWorkRowCommand | null
    /** What the menu says it holds, read aloud; used only when the row has both. */
    readonly menuLabel: string
    readonly isDisabled: boolean
}

/**
 * The end of a row: a lone action is a button that names it; a link beside a command is the button for the link and a menu for the
 * command, so the row never carries a button that only says "more".
 */
export const AgentWorkRowActions = (props: AgentWorkRowActionsProps) => {
    const { link, command } = props
    if (link === null) {
        if (command === null) return null
        return (
            <Button intent="neutral" size="sm" isDisabled={props.isDisabled} onPress={command.onPress}>
                {command.label}
            </Button>
        )
    }
    if (command === null) {
        return (
            <Button intent="neutral" size="sm" href={link.href}>
                {link.label}
            </Button>
        )
    }
    return (
        <>
            <Button intent="neutral" size="sm" href={link.href}>
                {link.label}
            </Button>
            <DropdownMenu
                placement="bottom end"
                trigger={
                    <IconButton
                        source={nivoIconSource("more", "leading")}
                        label={props.menuLabel}
                        intent="neutral"
                        isDisabled={props.isDisabled}
                    />
                }
                entries={[{ id: "command", label: command.label, onAction: command.onPress }]}
            />
        </>
    )
}
