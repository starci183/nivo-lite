import type { ReactNode } from "react"
import { Button, Cluster, Dialog, Stack, Text } from "@starci/grammar/common"

/** Copy the connected last-owner dialog supplies. */
export interface WorkspaceLeaveOwnerDialogBaseProps {
    readonly props: {
        readonly title: string
        readonly description: string
        readonly transferTitle: string
        readonly transferText: string
        readonly transferLabel: string
        readonly deleteTitle: string
        readonly deleteText: string
        readonly deleteLabel: string
        readonly closeLabel: string
    }
    readonly on: {
        readonly openTeam: () => void
        readonly startDelete: () => void
        readonly close: () => void
    }
}

/** What one way forward draws: its title, the line under it, and its one button. */
interface OptionProps {
    readonly title: string
    readonly text: string
    readonly action: ReactNode
}

/** One way forward: the title over its line at the start, its button at the end. */
const Option = (props: OptionProps) => (
    <Cluster gap="row" align="center" justify="between" wrap={false}>
        <Stack gap="identity" align="start">
            <Text isStrong>{props.title}</Text>
            <Text size="sm" tone="muted">
                {props.text}
            </Text>
        </Stack>
        {props.action}
    </Cluster>
)

/** Draws why the last owner cannot leave, with the two ways forward. */
export const WorkspaceLeaveOwnerDialogBase = (props: WorkspaceLeaveOwnerDialogBaseProps) => (
    <Dialog
        isOpen
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        title={props.props.title}
        description={props.props.description}
        footer={
            <Button intent="dismiss" onPress={props.on.close}>
                {props.props.closeLabel}
            </Button>
        }
    >
        <Stack gap="section">
            <Option
                title={props.props.transferTitle}
                text={props.props.transferText}
                action={
                    <Button intent="neutral" onPress={props.on.openTeam}>
                        {props.props.transferLabel}
                    </Button>
                }
            />
            <Option
                title={props.props.deleteTitle}
                text={props.props.deleteText}
                action={
                    <Button intent="destructive" step="entry" onPress={props.on.startDelete}>
                        {props.props.deleteLabel}
                    </Button>
                }
            />
        </Stack>
    </Dialog>
)
