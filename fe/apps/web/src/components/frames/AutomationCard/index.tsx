import { Cluster, Stack, Badge, Icon, Link, Switch, Text, TextAction } from "@starci/grammar/common"
import type { ReactNode } from "react"

import { AutomationMark } from "@/components/composites/AutomationMark"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { AutomationIconWord } from "@/modules/types"

/** The tone of a status badge. */
type CardTone = "success" | "neutral" | "warning" | "danger"

/** The one line under the card text: why the switch cannot be pressed, or the one thing to fix. */
type AutomationCardNote = {
    readonly text: string
    /** Where the owner fixes it, with the words of the link. */
    readonly link?: { readonly href: string; readonly label: string }
}

/** What one automation card shows, already in the reader language. */
type AutomationCardProps = {
    readonly description: string
    readonly triggerLine: string
    readonly statusLabel: string
    readonly statusTone: CardTone
    readonly icon: AutomationIconWord
    readonly note?: AutomationCardNote
    readonly sheet?: { readonly href: string; readonly label: string }
    readonly selectLabel: string
    readonly switchLabel: string
    readonly switchName: string
    readonly isSelected: boolean
    readonly isEnabled: boolean
    readonly isSwitchDisabled: boolean
    /** Stable automation identity for the owning collection. */
    readonly dataKey: string
    readonly onSelect: () => void
    readonly onToggle: (next: boolean) => void
    /** Extra controls under the card text (the Google account picker of a Sheets automation). */
    readonly children?: ReactNode
}

/**
 * The detail of one automation row: status, trigger, notes, hosted account controls, select and switch. The parent collection
 * owns the name, selected state and loading context, so this frame creates no second surface or heading.
 */
export const AutomationCard = (props: AutomationCardProps) => (
    <div data-automation={props.dataKey}>
        <Stack gap="row">
            <Cluster gap="row" align="start">
                <AutomationMark icon={props.icon} />
                <Stack gap="identity">
                    <Cluster gap="inline">
                        <Badge isDot tone={props.statusTone}>
                            {props.statusLabel}
                        </Badge>
                    </Cluster>
                </Stack>
            </Cluster>
            <Text size="sm" tone="muted">
                {props.description}
            </Text>
            <Text
                size="xs"
                tone="muted"

                startContent={<Icon source={nivoIconSource("trigger", "chip")} usage="chip" />}
            >
                {props.triggerLine}
            </Text>
            {props.note === undefined ? null : (
                <Text size="xs" tone="muted">
                    {props.note.text}
                    {props.note.link === undefined ? null : (
                        <>
                            {" "}
                            <Link href={props.note.link.href}>{props.note.link.label}</Link>
                        </>
                    )}
                </Text>
            )}
            {props.sheet === undefined ? null : (
                <Text size="xs">
                    <Link href={props.sheet.href} kind="external">
                        {props.sheet.label}
                    </Link>
                </Text>
            )}
            {props.children}
            <Cluster gap="inline" justify="between">
                <TextAction
                    appearance="disclosure"
                    size="sm"
                    isCurrent={props.isSelected}

                    onPress={props.onSelect}
                >
                    {props.selectLabel}
                </TextAction>
                <Switch
                    name={props.switchName}
                    label={props.switchLabel}
                    isSelected={props.isEnabled}
                    isDisabled={props.isSwitchDisabled}

                    onSelectedChange={props.onToggle}
                />
            </Cluster>
        </Stack>
    </div>
)
