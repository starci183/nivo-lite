import type { ReactElement } from "react"
import { Badge, Button, Cluster, Drawer, Heading, Quote, RadioGroup, Stack, Text } from "@starci/grammar/common"
import type { ConflictDrawerView, ConflictOptionView } from "@/modules/types"

/** Props for {@link ConflictDrawer}. */
interface ConflictDrawerProps {
    readonly props: {
        /** The comparison open; null while it is closed. */
        readonly view: ConflictDrawerView | null
    }
    readonly on: {
        readonly close: () => void
        readonly choose: (id: string) => void
        readonly confirm: () => void
    }
}

/** What one value of the comparison draws. */
interface OptionProps {
    readonly option: ConflictOptionView
}

/** What a part of the open comparison reads. */
interface ViewProps {
    readonly view: ConflictDrawerView
}

/** What the foot of the open comparison draws and does. */
interface OpenProps {
    readonly view: ConflictDrawerView
    readonly on: ConflictDrawerProps["on"]
}

/** What one value draws under its title: the words it was quoted in, the documents behind it and its condition. */
const OptionBody = (props: OptionProps) => (
    <Stack gap="identity">
        {props.option.quote === null ? null : <Quote text={props.option.quote} />}
        <Text size="xs" tone="muted">
            {props.option.sources.join(" · ")}
        </Text>
        {props.option.condition === null ? null : (
            <Text size="xs" tone="muted">
                {props.option.condition}
            </Text>
        )}
    </Stack>
)

/** The title of one value: the value and its badges. */
const OptionTitle = (props: OptionProps) => (
    <Cluster gap="inline">
        <Text isStrong>{props.option.value}</Text>
        {props.option.badges.map((badge) => (
            <Badge key={badge.label} tone={badge.tone}>
                {badge.label}
            </Badge>
        ))}
    </Cluster>
)

/** The foot of the drawer: what the choice does, then later and the one choice. */
const Footer = (props: OpenProps) => (
    <Cluster gap="inline" justify="between" align="center">
        <Text size="xs" tone="muted">
            {props.view.footerNote}
        </Text>
        <Cluster gap="inline">
            <Button intent="dismiss" onPress={props.on.close}>
                {props.view.laterLabel}
            </Button>
            {props.view.canWrite ? (
                <Button
                    intent="commit"
                    isPending={props.view.isPending}
                    isDisabled={props.view.chosenId === null}
                    onPress={props.on.confirm}
                >
                    {props.view.chooseLabel}
                </Button>
            ) : null}
        </Cluster>
    </Cluster>
)

/** What the agent answers today: the value in use, or that none is approved yet. */
const Today = (props: ViewProps) => (
    <Stack gap="row">
        <Heading level={3}>{props.view.todayTitle}</Heading>
        <Stack gap="identity">
            <Cluster gap="inline" justify="between">
                <Text size="xs" tone="muted">
                    {props.view.today.label}
                </Text>
                <Badge tone={props.view.today.badge.tone}>{props.view.today.badge.label}</Badge>
            </Cluster>
            {props.view.today.value === null ? null : <Text isStrong>{props.view.today.value}</Text>}
            <Text size="xs" tone="muted">
                {props.view.today.note}
            </Text>
        </Stack>
    </Stack>
)

/** Which agents read the fact. */
const Readers = (props: ViewProps) => (
    <Stack gap="row">
        <Heading level={3}>{props.view.readersTitle}</Heading>
        {props.view.readers.length === 0 ? <Text tone="muted">{props.view.readersEmpty}</Text> : null}
        {props.view.readers.map((reader) => (
            <Stack key={reader.id} gap="identity">
                <Text isStrong>{reader.name}</Text>
                <Text size="xs" tone="muted">
                    {reader.line}
                </Text>
            </Stack>
        ))}
    </Stack>
)

/**
 * The comparison of the values of one subject and attribute, in a wide drawer and in this order: what the agent answers today; each
 * value with its quote, documents, trust and condition; which agents read it; the choice. The value chosen replaces every other wording.
 */
export const ConflictDrawer = (props: ConflictDrawerProps): ReactElement | null => {
    const { view } = props.props
    const { on } = props
    if (view === null) return null
    return (
        <Drawer
            isOpen
            onOpenChange={(open) => {
                if (!open) on.close()
            }}
            title={view.title}
            description={view.description}
            closeLabel={view.closeLabel}
            placement="right"
            width="wide"
            footer={<Footer view={view} on={on} />}
        >
            <Stack gap="section">
                <Today view={view} />
                <RadioGroup
                    label={view.chooseTitle}
                    appearance="rows"
                    value={view.chosenId}
                    isDisabled={!view.canWrite}
                    onValueChange={on.choose}
                    options={view.options.map((option) => ({
                        value: option.id,
                        label: <OptionTitle option={option} />,
                        description: <OptionBody option={option} />,
                    }))}
                />
                <Readers view={view} />
            </Stack>
        </Drawer>
    )
}
