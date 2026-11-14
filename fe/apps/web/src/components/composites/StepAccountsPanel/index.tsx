import { Button, DropdownMenu, Stack, SurfaceCard, Text, type ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { StepAccountsSlotView, StepAction } from "@/modules/types"
import { Effective, Titled, type ActionProps, type EditProps, type ViewProps } from "./parts"

/** What the accounts section of a step's panel draws and what it does. */
interface StepAccountsPanelProps {
    readonly view: StepAccountsSlotView
    readonly onAction: (action: StepAction) => void
}

/**
 * The one mode of the node as the card's switch zone (a pill of two in the card's first header row, the one line under it saying what
 * each value does); nothing is drawn for a node that declares none.
 */
const ModeCard = (props: EditProps) => {
    const { view } = props
    const mode = view.mode
    if (mode === null) return null
    // Whoever may not change the mode reads it as words, not as a greyed switch.
    if (view.isReadOnly)
        return (
            <SurfaceCard
                kind="details"
                ariaLabel={mode.title}
                isLoading={props.isLoading}
                note={mode.hint}
                items={[{ id: "mode", term: mode.label, description: mode.options[mode.value] }]}
            />
        )
    return (
        <SurfaceCard
            kind="list"
            ariaLabel={mode.title}
            isLoading={props.isLoading}
            note={mode.hint}
            empty={null}
            items={[]}
            headers={[
                {
                    kind: "switch",
                    label: mode.label,
                    title: mode.title,
                    selectedKey: mode.value,
                    onSelect: (key) => {
                        if (key === "auto" || key === "ask") props.onAction({ kind: "node-mode", mode: key })
                    },
                    items: [
                        { id: "auto", label: mode.options.auto },
                        { id: "ask", label: mode.options.ask },
                    ],
                },
            ]}
        />
    )
}

/**
 * A node that acts through providers but declares no mode (a graph stored before every node declared one): no switch to draw, so the
 * panel says so in one muted line instead of leaving the section looking broken.
 */
const ModeMissing = (props: ViewProps) =>
    props.view.modeNote === null ? null : <Text tone="muted">{props.view.modeNote}</Text>

/** The providers the node acts through, in the order they are tried: a row each, with the neutral small remove at the end; what the add command can pick from is the line under the card. */
const AccountsCard = (props: EditProps) => {
    const { view } = props
    const items: ReadonlyArray<ListRowData> = view.accounts.map((account) => ({
        id: `${account.index}`,
        title: account.name,
        description: account.line,
        actionPlacement: "end" as const,
        ...(view.isReadOnly
            ? {}
            : {
                  action: {
                      label: view.removeLabel,
                      intent: "neutral" as const,
                      press: () => props.onAction({ kind: "account-remove", index: account.index }),
                  },
              }),
    }))
    return (
        <SurfaceCard
            kind="list"
            ariaLabel={view.sectionTitle}
            isLoading={props.isLoading}
            {...(view.isReadOnly ? {} : { note: view.addHint })}
            empty={<Text tone="muted">{view.noProvider}</Text>}
            items={items}
        />
    )
}

/** add provider: the agent's attached accounts the step does not use yet, as the one small neutral command at the end of the group's head row. */
const AddProvider = (props: ActionProps) => {
    const { view } = props
    if (view.isReadOnly) return null
    return (
        <DropdownMenu
            placement="bottom end"
            entries={view.addOptions.map((option) => ({
                id: option.id,
                label: option.label,
                onAction: () => props.onAction({ kind: "account-add", connectionId: option.id }),
            }))}
            trigger={
                <Button size="sm" intent="neutral" isDisabled={view.addOptions.length === 0}>
                    {view.addLabel}
                </Button>
            }
        />
    )
}

/** The section once its data is read. */
const Section = (props: EditProps) => (
    <Stack gap="section">
        <Titled
            title={props.view.sectionTitle}
            hint={props.view.sectionHint}
            end={<AddProvider view={props.view} onAction={props.onAction} />}
            body={
                <>
                    <ModeCard {...props} />
                    <ModeMissing view={props.view} />
                    <AccountsCard {...props} />
                </>
            }
        />
        <Effective view={props.view} isLoading={props.isLoading} />
    </Stack>
)

/**
 * The rights section of a workflow step's panel (rights.md: ONE mode per node, `auto | ask`): the node's mode as a two-value pill, the
 * providers the node acts through (picked among the agent's attached accounts, in the order they are tried; add provider is the small
 * neutral command at the end of the group's head row) and, read only, what the
 * step can really do. It edits the DRAFT graph; publishing is the one road to make it live.
 */
export const StepAccountsPanel = (props: StepAccountsPanelProps) => (
    <SlotView
        slot={props.view.slot}
        placeholder={props.view.placeholder}
        labels={props.view.labels}
        onRetry={props.view.retry}
        render={(view, isLoading) => <Section view={view} isLoading={isLoading} onAction={props.onAction} />}
    />
)
