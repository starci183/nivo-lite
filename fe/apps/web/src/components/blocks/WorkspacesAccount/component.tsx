import { Button, DropdownMenu, Text } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"
import { PersonAvatar } from "@/components/leaves/PersonAvatar"

/** The person and the entries the connected account menu supplies. */
export interface WorkspacesAccountBaseProps {
    readonly props: {
        readonly email: string
        readonly entries: ReadonlyArray<DropdownMenuEntry>
    }
}

/** Draws the account menu of the workspaces area: the avatar and email open Account and Sign out. */
export const WorkspacesAccountBase = (props: WorkspacesAccountBaseProps) => (
    <DropdownMenu
        placement="bottom end"
        entries={props.props.entries}
        trigger={
            <Button intent="neutral" size="sm" startContent={<PersonAvatar name={props.props.email} size="sm" />}>
                <Text as="span" size="sm" overflow="truncate">
                    {props.props.email}
                </Text>
            </Button>
        }
    />
)
