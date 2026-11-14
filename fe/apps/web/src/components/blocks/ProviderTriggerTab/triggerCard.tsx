import { SlotView } from "@nivo-lite/agent-sdk/client"
import { Badge, Cluster, EmptyNotice, Link, Section, Select, Stack, SurfaceCard, Switch, Text, type ListRowData } from "@starci/grammar/common"
import type { DataSlot, ProviderTriggerCardView, ProviderTriggerRowView, SlotLabels } from "@/modules/types"

/** The option that unbinds the decider (the API's `agentId: null`). */
const NO_AGENT = "none"

/** The words of the Trigger card, already in the reader's language. */
export interface ProviderTriggerCardWords {
    readonly title: string
    readonly switchLabel: (trigger: string) => string
    readonly workflowsTitle: string
    readonly workflowsNone: string
    readonly catchUpTitle: string
    readonly catchUpHint: string
    readonly deciderTitle: string
    readonly deciderHint: string
    readonly deciderLabel: (trigger: string) => string
    readonly deciderNone: string
    readonly deciderPlaceholder: string
    readonly empty: string
}

/** The words, the read and the commands of the Trigger card of an account's Trigger tab. */
export interface ProviderTriggerCardBaseProps {
    readonly words: ProviderTriggerCardWords
    readonly slot: DataSlot<ProviderTriggerCardView>
    readonly placeholder: ProviderTriggerCardView
    readonly slotLabels: SlotLabels
    /** Owner or manager change the switches; anyone else reads them. */
    readonly canEdit: boolean
    /** A change is on its way: the controls wait. */
    readonly isBusy: boolean
    /** The words of the last refusal; null when there is none. */
    readonly error: string | null
    readonly on: {
        readonly toggle: (trigger: string, isOn: boolean) => void
        readonly catchUp: (isOn: boolean) => void
        readonly bind: (trigger: string, agentId: string | null) => void
        readonly retry: () => void
    }
}

/** A line under the row's copy at 12, muted. */
const detailOf = (text: string) => (
    <Text size="xs" tone="muted">
        {text}
    </Text>
)

/** The switch row of one trigger: the registry's summary, the switch at the end, its kind and last fire under the title. */
const switchRowOf = (row: ProviderTriggerRowView, props: ProviderTriggerCardBaseProps, isLoading: boolean): ListRowData => ({
    id: `switch-${row.id}`,
    title: row.title,
    detail: detailOf(`${row.kindLabel} · ${row.fired ?? ""}`),
    control: (
        <Switch
            name={`trigger-${row.id}`}
            label={props.words.switchLabel(row.title)}
            isLabelHidden
            isSelected={row.isOn}
            isDisabled={!props.canEdit || props.isBusy}
            isLoading={isLoading}
            onSelectedChange={(isOn) => props.on.toggle(row.id, isOn)}
        />
    ),
})

/** What one workflow's link draws. */
interface WorkflowLinkProps {
    readonly name: string
    readonly href: string | null
    readonly isLoading: boolean
}

/** One workflow's name as a plain link to its map; it rests as the same link, disabled, where the agent has no page or the read is loading. */
const WorkflowLink = (props: WorkflowLinkProps) => (
    <Link href={props.href ?? ""} variant="plain" isDisabled={props.href === null || props.isLoading}>
        {props.name}
    </Link>
)

/** The workflows row of one trigger: each workflow it wakes as a plain link with its agent and role beside it, or the muted none line. */
const workflowsRowOf = (
    row: ProviderTriggerRowView,
    props: ProviderTriggerCardBaseProps,
    isLoading: boolean,
    hasMany: boolean,
): ListRowData => ({
    id: `workflows-${row.id}`,
    title: hasMany ? `${props.words.workflowsTitle} · ${row.title}` : props.words.workflowsTitle,
    detail:
        row.workflows.length === 0 ? (
            detailOf(props.words.workflowsNone)
        ) : (
            <Stack gap="row">
                {row.workflows.map((workflow) => (
                    <Cluster key={workflow.id} gap="inline" wrap align="center">
                        <WorkflowLink name={workflow.name} href={workflow.href} isLoading={isLoading} />
                        {workflow.name === workflow.chip ? null : (
                            <Badge tone="neutral" isLoading={isLoading}>
                                {workflow.chip}
                            </Badge>
                        )}
                    </Cluster>
                ))}
            </Stack>
        ),
})

/** The decider row of one trigger: locked to the core agent's name, or a select over the attached agents and none. */
const deciderRowOf = (
    row: ProviderTriggerRowView,
    props: ProviderTriggerCardBaseProps,
    isLoading: boolean,
    hasMany: boolean,
): ListRowData | null => {
    const decider = row.decider
    if (decider === null) return null
    const words = props.words
    return {
        id: `decider-${row.id}`,
        title: hasMany ? `${words.deciderTitle} · ${row.title}` : words.deciderTitle,
        control:
            decider.kind === "locked" ? (
                <Badge tone="neutral" isLoading={isLoading}>
                    {decider.agentName}
                </Badge>
            ) : (
                <Select
                    label={words.deciderLabel(row.title)}
                    isLabelHidden
                    appearance="compact"
                    placeholder={words.deciderPlaceholder}
                    isDisabled={!props.canEdit || props.isBusy}
                    isLoading={isLoading}
                    value={decider.agentId ?? NO_AGENT}
                    onValueChange={(value) => props.on.bind(row.id, value === null || value === NO_AGENT ? null : value)}
                    options={[
                        { id: NO_AGENT, label: words.deciderNone },
                        ...decider.options.map((option) => ({ id: option.id, label: option.label })),
                    ]}
                />
            ),
    }
}

/** The rows of the card: each trigger's switch and workflows, then the "when turned on again" choice, then the deciders. */
const rowsOf = (view: ProviderTriggerCardView, props: ProviderTriggerCardBaseProps, isLoading: boolean): ListRowData[] => {
    const hasMany = view.rows.length > 1
    const deciders = view.rows
        .map((row) => deciderRowOf(row, props, isLoading, hasMany))
        .filter((row): row is ListRowData => row !== null)
    return [
        ...view.rows.flatMap((row) => [switchRowOf(row, props, isLoading), workflowsRowOf(row, props, isLoading, hasMany)]),
        ...(view.hasCatchUp
            ? [
                  {
                      id: "catch-up",
                      title: props.words.catchUpTitle,
                      control: (
                          <Switch
                              name="trigger-catch-up"
                              label={props.words.catchUpTitle}
                              isLabelHidden
                              isSelected={view.catchUp}
                              isDisabled={!props.canEdit || props.isBusy}
                              isLoading={isLoading}
                              onSelectedChange={props.on.catchUp}
                          />
                      ),
                  },
              ]
            : []),
        ...deciders,
    ]
}

/** The caption under the card: the refusal of the last change when there is one, then what the two extra choices mean. */
const noteOf = (view: ProviderTriggerCardView, props: ProviderTriggerCardBaseProps) => {
    const hasDecider = view.rows.some((row) => row.decider !== null)
    if (props.error === null && !view.hasCatchUp && !hasDecider) return undefined
    return (
        <Stack gap="identity">
            {props.error === null ? null : (
                <Text size="xs" tone="muted">
                    {props.error}
                </Text>
            )}
            {view.hasCatchUp ? (
                <Text size="xs" tone="muted">
                    {`${props.words.catchUpTitle}: ${props.words.catchUpHint}`}
                </Text>
            ) : null}
            {hasDecider ? (
                <Text size="xs" tone="muted">
                    {`${props.words.deciderTitle}: ${props.words.deciderHint}`}
                </Text>
            ) : null}
        </Stack>
    )
}

/**
 * The Trigger section of the Trigger tab: its label stays whatever the read answers (a provider with no trigger keeps the label and
 * says so under it), then one `SurfaceCard kind="list"` of switch rows (one trigger each: registry summary, kind, last fire and the
 * switch), the workflows each trigger wakes as plain links, the "when turned on again" choice where a trigger can catch up and the
 * deciding agent where a trigger has one. A refusal and the two choices' meaning are the caption under the card.
 */
export const ProviderTriggerCardBase = (props: ProviderTriggerCardBaseProps) => (
    <Section kind="region" title={props.words.title} headingLevel={2}>
        <SlotView
            slot={props.slot}
            placeholder={props.placeholder}
            labels={props.slotLabels}
            onRetry={props.on.retry}
            render={(view, isLoading) => {
                const note = noteOf(view, props)
                return (
                    <SurfaceCard
                        kind="list"
                        ariaLabel={props.words.title}
                        isLoading={isLoading}
                        items={rowsOf(view, props, isLoading)}
                        empty={<EmptyNotice message={props.words.empty} />}
                        {...(note === undefined ? {} : { note })}
                    />
                )
            }}
        />
    </Section>
)
