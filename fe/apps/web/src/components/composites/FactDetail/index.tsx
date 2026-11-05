import { Button, Cluster, DescriptionList, Divider, Heading, Icon, Stack, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { FactDetailView, FactHistoryView } from "@/modules/types"

/** What the opened fact draws. */
interface FactDetailProps {
    readonly detail: FactDetailView
    /** The first read has no data yet: the words keep their boxes, the values draw as geometry. */
    readonly isLoading: boolean
    readonly onRetire: () => void
}

/** What the history of the value draws. */
interface FactHistoryProps {
    readonly title: string
    readonly history: ReadonlyArray<FactHistoryView>
    readonly isLoading: boolean
}

/** The values the fact had: each value, and what became of it, on one line. */
const FactHistory = (props: FactHistoryProps) => (
    <Stack gap="row">
        <Heading level={3}>{props.title}</Heading>
        {props.history.map((one) => (
            <Cluster key={one.id} gap="inline" justify="between" align="center" wrap={false}>
                <Text isStrong isLoading={props.isLoading}>
                    {one.value}
                </Text>
                <Text size="xs" tone="muted" isLoading={props.isLoading}>
                    {one.line}
                </Text>
            </Cluster>
        ))}
    </Stack>
)

/** The two commands on the value, end-aligned: stop using it (which asks first), and give it a new value. */
/** What the commands on the value draw. */
interface FactCommandsProps {
    readonly detail: FactDetailView
    readonly onRetire: () => void
}

const FactCommands = (props: FactCommandsProps) => {
    const { edit, retire } = props.detail
    if (edit === null && retire === null) return null
    return (
        <Cluster gap="inline" justify="end">
            {retire === null ? null : (
                <Button intent="destructive" isPending={retire.isPending} onPress={props.onRetire}>
                    {retire.label}
                </Button>
            )}
            {edit === null ? null : (
                <Button
                    intent="neutral"
                    href={edit.href}
                    startContent={<Icon source={nivoIconSource("edit", "leading")} usage="leading" />}
                >
                    {edit.label}
                </Button>
            )}
        </Cluster>
    )
}

/**
 * The opened fact under its head: the value large, what it is filed under, the two commands on it, then the values it had. While
 * the read waits the same boxes draw as geometry.
 */
export const FactDetail = (props: FactDetailProps) => {
    const detail = props.detail
    return (
        <Stack gap="section">
            <Stack gap="row">
                <Text size="xs" tone="muted">
                    {detail.valueLabel}
                </Text>
                <Heading level={3} scale="display" isLoading={props.isLoading}>
                    {detail.value}
                </Heading>
            </Stack>
            <DescriptionList
                density="compact"
                items={detail.terms.map((term) => ({ id: term.id, term: term.term, description: term.text }))}
                isLoading={props.isLoading}
            />
            <FactCommands detail={detail} onRetire={props.onRetire} />
            {detail.history.length === 0 ? null : (
                <>
                    <Divider semantics="presentation" />
                    <FactHistory title={detail.historyTitle} history={detail.history} isLoading={props.isLoading} />
                </>
            )}
        </Stack>
    )
}
