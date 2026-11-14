import { AlertDialog, Button, Cluster, DropdownMenu, Heading, Icon, Stack, Text } from "@starci/grammar/common"
import { AgentRunStatusMark, nivoIconSource } from "@/components/leaves/Icon"
import type { RunHeadView, RunSwitchView } from "@/modules/types"

/** The words of the command that stops a run. */
interface AgentRunCancelCopy {
    readonly label: string
    readonly dialogTitle: string
    readonly note: string
    readonly keepLabel: string
    readonly confirmLabel: string
}

/** The words of the head card of a run. */
export interface AgentRunHeadCopy {
    readonly ariaLabel: string
    readonly resume: string
    readonly switchLabel: string
    readonly isResuming: boolean
    readonly isCancelling: boolean
    readonly cancel: AgentRunCancelCopy
}

/** What the head card draws and what it does. */
interface AgentRunHeadProps {
    readonly props: {
        readonly copy: AgentRunHeadCopy
        readonly head: RunHeadView
        readonly switches: ReadonlyArray<RunSwitchView>
        readonly isLoading: boolean
    }
    readonly on: {
        readonly resume: () => void
        readonly cancel: () => void
    }
}

/** What the retry command draws. */
interface ResumeButtonProps {
    readonly label: string
    /** Another command of the page is the one primary: this one is a plain button. */
    readonly isNeutral: boolean
    readonly isPending: boolean
    readonly onPress: () => void
}

/** The command that runs a stopped run again: the page's one primary (with its icon), or neutral when another command holds that place. */
const ResumeButton = (props: ResumeButtonProps) =>
    props.isNeutral ? (
        <Button intent="neutral" isPending={props.isPending} onPress={props.onPress}>
            {props.label}
        </Button>
    ) : (
        <Button
            intent="commit"
            startContent={<Icon source={nivoIconSource("retry", "leading")} />}
            isPending={props.isPending}
            onPress={props.onPress}
        >
            {props.label}
        </Button>
    )

/**
 * The head of a run, on the well and in no card: its title and id, where it stands (an outline mark and the word), the line of when and
 * on what it ran, the quick switch to the runs that are running now, the neutral command that stops a run, and the retry command, the
 * ONE primary of the page, when the run failed and may run again from its failed step.
 */
export const AgentRunHead = (props: AgentRunHeadProps) => {
    const { copy, head, switches } = props.props
    return (
        <Stack gap="inline">
            <Cluster gap="identity" justify="between">
                <Stack gap="identity">
                    <Cluster gap="inline">
                        <Heading level={2}>{head.title}</Heading>
                        <Text tone="muted">{`#${head.shortId}`}</Text>
                        <Cluster gap="identity" wrap={false}>
                            <AgentRunStatusMark props={{ status: head.status, label: head.statusLabel }} />
                            <Text>{head.statusLabel}</Text>
                        </Cluster>
                    </Cluster>
                    <Text size="xs" tone="muted">
                        {head.meta}
                    </Text>
                </Stack>
                <Cluster gap="inline">
                    {switches.length === 0 ? null : (
                        <DropdownMenu
                            placement="bottom end"
                            entries={switches.map((entry) => ({ id: entry.id, label: entry.label, href: entry.href }))}
                            trigger={<Button intent="neutral">{copy.switchLabel}</Button>}
                        />
                    )}
                    {head.canCancel ? (
                        <AlertDialog
                            title={copy.cancel.dialogTitle}
                            tone="negative"
                            cancelLabel={copy.cancel.keepLabel}
                            confirmLabel={copy.cancel.confirmLabel}
                            isConfirmPending={copy.isCancelling}
                            onConfirm={props.on.cancel}
                            trigger={<Button intent="neutral">{copy.cancel.label}</Button>}
                        >
                            <Text size="sm">{copy.cancel.note}</Text>
                        </AlertDialog>
                    ) : null}
                    {head.canResume ? (
                        <ResumeButton
                            label={copy.resume}
                            isNeutral={head.isRetryNeutral}
                            isPending={copy.isResuming}
                            onPress={props.on.resume}
                        />
                    ) : null}
                </Cluster>
            </Cluster>
        </Stack>
    )
}
