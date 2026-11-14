import { Section, Stack, SurfaceCard, Text, type SelectItemData } from "@starci/grammar/common"
import { ProviderRightsCard, type ProviderRightsCardProps } from "@/components/composites/ProviderRightsCard"

/** The providers field: one card per connected account of a provider the template needs (with a chip "by template"), and a dimmed line for one not connected. */
export interface ProvidersFieldView {
    readonly label: string
    readonly chip: string
    readonly cards: ReadonlyArray<{ readonly id: string; readonly card: ProviderRightsCardProps }>
    readonly notConnected: ReadonlyArray<string>
    readonly emptyLabel: string
}

/** What the providers choice needs. */
export interface ProvidersChoiceProps {
    readonly view: ProvidersFieldView
}

/** The account cards of the create dialog: the template's accounts, on by default, switchable off before the create button. */
export const ProvidersChoice = (props: ProvidersChoiceProps) => (
    <Section kind="region" title={props.view.label} fact={props.view.chip} headingLevel={3}>
        <Stack gap="inline">
            {props.view.cards.length === 0 ? <Text tone="muted">{props.view.emptyLabel}</Text> : null}
            {props.view.cards.map((entry) => (
                <ProviderRightsCard key={entry.id} {...entry.card} />
            ))}
            {props.view.notConnected.map((line) => (
                <Text key={line} size="sm" tone="muted">
                    {line}
                </Text>
            ))}
        </Stack>
    </Section>
)

/** Where the setup starts. */
export interface StartFieldView {
    readonly label: string
    readonly items: ReadonlyArray<SelectItemData>
    readonly value: string
}

/** What the start choice needs. */
export interface StartChoiceProps {
    readonly view: StartFieldView
    readonly onChange: (value: string) => void
}

/** Where the setup starts: a choice card with one row checked. */
export const StartChoice = (props: StartChoiceProps) => (
    <SurfaceCard
        kind="select"
        selectionMode="single"
        label={props.view.label}
        items={props.view.items}
        value={props.view.value}
        onChange={props.onChange}
    />
)
