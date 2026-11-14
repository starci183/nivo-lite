import { SlotView } from "@nivo-lite/agent-sdk/client"
import { EmptyNotice, Grid, Input, Select, SurfaceCard, Switch, Text, type ListRowData } from "@starci/grammar/common"
import type { DataSlot, SlotLabels, WebsiteChannelAgentView, WebsiteChannelView } from "@/modules/types"

/** The option that leaves the customers to the default agent (the API's `agentId: null`). */
const DEFAULT_AGENT = "default"

/** The words of the website channel, already in the reader's language. */
export interface WebsiteChannelWords {
    readonly title: string
    readonly enabledTitle: string
    readonly enabledBody: string
    readonly chatTitle: string
    readonly chatBody: string
    readonly formTitle: string
    readonly formBody: string
    readonly pricesTitle: string
    readonly pricesBody: string
    readonly agentTitle: string
    readonly agentBody: string
    readonly agentLabel: string
    readonly agentDefault: string
    readonly attachTitle: string
    readonly attachHint: string
    readonly linkLabel: string
    readonly linkHint: string
    readonly embedLabel: string
    readonly embedHint: string
    readonly copyLabel: string
    readonly copiedLabel: string
    readonly pendingNote: string
}

/** The words, the read and the commands of the website channel on the Connections page. */
export interface WebsiteChannelBaseProps {
    readonly props: {
        readonly words: WebsiteChannelWords
        readonly slot: DataSlot<WebsiteChannelView>
        readonly placeholder: WebsiteChannelView
        readonly slotLabels: SlotLabels
        readonly errorBody: string
        readonly agents: ReadonlyArray<WebsiteChannelAgentView>
        readonly isAgentsLoading: boolean
        /** Owner or manager change the card. */
        readonly canEdit: boolean
        /** A change is on its way: the controls wait. */
        readonly isBusy: boolean
        /** The words of the last refusal; null when there is none. */
        readonly error: string | null
    }
    readonly on: {
        readonly enabled: (isOn: boolean) => void
        readonly chat: (isOn: boolean) => void
        readonly form: (isOn: boolean) => void
        readonly prices: (isOn: boolean) => void
        readonly agent: (agentId: string | null) => void
        readonly retry: () => void
    }
}

type Props = WebsiteChannelBaseProps

/** One switch row: the title and the description at the start, the switch at the end. */
const switchRowOf = (
    id: string,
    title: string,
    body: string,
    isOn: boolean,
    onChange: (isOn: boolean) => void,
    props: Props,
    isLoading: boolean,
): ListRowData => ({
    id,
    title,
    description: body,
    control: (
        <Switch
            name={`website-${id}`}
            label={title}
            isLabelHidden
            isSelected={isOn}
            isDisabled={!props.props.canEdit || props.props.isBusy}
            isLoading={isLoading}
            onSelectedChange={onChange}
        />
    ),
})

/** The rows in the old editor's order: the intake switch, the three things the site shows, then who takes the customers. */
const rowsOf = (view: WebsiteChannelView, props: Props, isLoading: boolean): ListRowData[] => {
    const { words } = props.props
    return [
        switchRowOf("enabled", words.enabledTitle, words.enabledBody, view.isEnabled, props.on.enabled, props, isLoading),
        switchRowOf("chat", words.chatTitle, words.chatBody, view.chatOn, props.on.chat, props, isLoading),
        switchRowOf("form", words.formTitle, words.formBody, view.formOn, props.on.form, props, isLoading),
        switchRowOf("prices", words.pricesTitle, words.pricesBody, view.pricesOn, props.on.prices, props, isLoading),
        {
            id: "agent",
            title: words.agentTitle,
            description: words.agentBody,
            control: (
                <Select
                    label={words.agentLabel}
                    isLabelHidden
                    appearance="compact"
                    isDisabled={!props.props.canEdit || props.props.isBusy}
                    isLoading={isLoading || props.props.isAgentsLoading}
                    value={view.agentId ?? DEFAULT_AGENT}
                    onValueChange={(value) => props.on.agent(value === null || value === DEFAULT_AGENT ? null : value)}
                    options={[
                        { id: DEFAULT_AGENT, label: words.agentDefault },
                        ...props.props.agents.map((agent) => ({ id: agent.id, label: agent.label })),
                    ]}
                />
            ),
        },
    ]
}

/** What the body draws: the card's props, the view and whether it is the placeholder of the first read. */
interface BodyProps extends Props {
    readonly view: WebsiteChannelView
    readonly isLoading: boolean
}

/** The body: the settings card and, beside it, the card with the address to share and the code to paste. */
const Body = (props: BodyProps) => {
    const { words } = props.props
    const { view, isLoading } = props
    return (
        <Grid
            kind="pair"
            leading={
                <SurfaceCard
                    kind="list"
                    label={words.title}
                    headingLevel={2}
                    isLoading={isLoading}
                    items={rowsOf(view, props, isLoading)}
                    empty={<EmptyNotice message={words.title} />}
                    note={
                        <Text size="xs" tone="muted">
                            {props.props.error ?? words.pendingNote}
                        </Text>
                    }
                />
            }
            trailing={
                <SurfaceCard
                    label={words.attachTitle}
                    headingLevel={2}
                    isLoading={isLoading}
                    note={
                        <Text size="xs" tone="muted">
                            {words.attachHint}
                        </Text>
                    }
                >
                    <Grid kind="form" columns={1}>
                        <Input
                            id="website-form-link"
                            name="websiteFormLink"
                            label={words.linkLabel}
                            description={words.linkHint}
                            value={view.formUrl}
                            isReadOnly
                            isLoading={isLoading}
                            isCopyable
                            copyLabel={words.copyLabel}
                            copiedLabel={words.copiedLabel}
                        />
                        <Input
                            id="website-form-embed"
                            name="websiteFormEmbed"
                            label={words.embedLabel}
                            description={words.embedHint}
                            value={view.snippet}
                            isReadOnly
                            isLoading={isLoading}
                            isCopyable
                            copyLabel={words.copyLabel}
                            copiedLabel={words.copiedLabel}
                        />
                    </Grid>
                </SurfaceCard>
            }
        />
    )
}

/**
 * The website channel on the Connections page (the website needs no account, so it has no page of its own): one list card of the
 * settings (the intake switch, the three things the site shows, the agent that takes the customers; each change saves at once) beside
 * one card with the address of the hosted form and the code that embeds it, each copyable. The words in the cards are real while
 * the read waits; only the values are skeletons. A read that fails says so with a retry.
 */
export const WebsiteChannelBase = (props: WebsiteChannelBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder={props.props.placeholder}
        labels={props.props.slotLabels}
        errorDescription={props.props.errorBody}
        onRetry={props.on.retry}
        render={(view, isLoading) => <Body {...props} view={view} isLoading={isLoading} />}
    />
)
