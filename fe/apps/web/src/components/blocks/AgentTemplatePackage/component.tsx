import { Alert, Button, Input, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { ReactElement } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { ACTIONS_CLASS_NAME, BLOCK_CLASS_NAME, CARD_CLASS_NAME } from "./classNames"

/** The words of the preview: what the package keeps, leaves out, needs and why it is refused. */
interface PreviewView {
    readonly lines: ReadonlyArray<string>
    readonly problems: ReadonlyArray<string>
    readonly suggestions: ReadonlyArray<string>
}

/** One text field of the form. */
interface FieldView {
    readonly name: string
    readonly label: string
    readonly value: string
}

/** Copy, values and state the connected packaging form supplies. */
export interface AgentTemplatePackageBaseProps {
    readonly props: {
        readonly slot: DataSlot<string>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly note: string
        readonly fields: ReadonlyArray<FieldView>
        readonly soulLabel: string
        readonly soul: string
        readonly changelogLabel: string
        readonly changelog: string
        readonly breakingLabel: string
        readonly previewLabel: string
        readonly packageLabel: string
        readonly previewTitle: string
        readonly problemsTitle: string
        readonly suggestionsTitle: string
        readonly preview: PreviewView | undefined
        readonly canPackage: boolean
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly setField: (name: string, value: string) => void
        readonly setSoul: (value: string) => void
        readonly setChangelog: (value: string) => void
        readonly toggleBreaking: () => void
        readonly showPreview: () => void
        readonly savePackage: () => void
    }
}

/** What the preview card draws. */
interface PreviewCardProps {
    readonly copy: AgentTemplatePackageBaseProps["props"]
    readonly preview: PreviewView
}

/** What the preview says, in its own card. */
const PreviewCard = (props: PreviewCardProps): ReactElement => (
    <SurfaceCard label={props.copy.previewTitle} headingLevel={2}>
        <div className={CARD_CLASS_NAME}>
            {props.preview.lines.map((line) => (
                <Text key={line} size="sm">
                    {line}
                </Text>
            ))}
            {props.preview.problems.length === 0 ? null : (
                <Alert
                    tone="negative"
                    title={props.copy.problemsTitle}
                    description={props.preview.problems.join(" | ")}
                />
            )}
            {props.preview.suggestions.length === 0 ? null : (
                <>
                    <Text size="sm">{props.copy.suggestionsTitle}</Text>
                    {props.preview.suggestions.map((line) => (
                        <Text key={line} size="xs" tone="muted">
                            {line}
                        </Text>
                    ))}
                </>
            )}
        </div>
    </SurfaceCard>
)

/** The text fields of the card of the template. */
const CardFields = (props: Pick<AgentTemplatePackageBaseProps, "props" | "on">): ReactElement => (
    <>
        {props.props.fields.map((field) => (
            <Input
                key={field.name}
                id={`package-${field.name}`}
                name={field.name}
                label={field.label}
                value={field.value}
                isDisabled={props.props.isPending}
                onValueChange={(value) => props.on.setField(field.name, value)}
            />
        ))}
        <Textarea
            id="package-soul"
            name="soul"
            label={props.props.soulLabel}
            rows={3}
            value={props.props.soul}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setSoul}
        />
        <Textarea
            id="package-changelog"
            name="changelog"
            label={props.props.changelogLabel}
            rows={2}
            value={props.props.changelog}
            isDisabled={props.props.isPending}
            onValueChange={props.on.setChangelog}
        />
    </>
)

/**
 * Draws the packaging of the process of one agent: the version that is frozen, the card of the template, what the package keeps, leaves
 * out and needs from the buyer (the preview), and the commands to preview and to save the next version.
 */
export const AgentTemplatePackageBase = (props: AgentTemplatePackageBaseProps): ReactElement => {
    const view = props.props
    return (
        <div className={BLOCK_CLASS_NAME}>
            <SurfaceCard label={view.title} headingLevel={2}>
                <div className={CARD_CLASS_NAME}>
                    <SlotView
                        slot={view.slot}
                        placeholder="-"
                        labels={view.slotLabels}
                        onRetry={props.on.retry}
                        render={(label) => <Text size="sm">{label}</Text>}
                    />
                    <Text size="sm" tone="muted">
                        {view.note}
                    </Text>
                    <CardFields props={view} on={props.on} />
                    <div className={ACTIONS_CLASS_NAME}>
                        <Button intent="neutral" isDisabled={view.isPending} onPress={props.on.toggleBreaking}>
                            {view.breakingLabel}
                        </Button>
                        <Button intent="neutral" isPending={view.isPending} onPress={props.on.showPreview}>
                            {view.previewLabel}
                        </Button>
                        <Button
                            intent="commit"
                            isPending={view.isPending}
                            isDisabled={!view.canPackage}
                            onPress={props.on.savePackage}
                        >
                            {view.packageLabel}
                        </Button>
                    </div>
                </div>
            </SurfaceCard>
            {view.preview === undefined ? null : <PreviewCard copy={view} preview={view.preview} />}
        </div>
    )
}
