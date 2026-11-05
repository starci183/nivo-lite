import { Alert, Button, Grid, Input, Stack, SurfaceCard, Switch, Text, Textarea } from "@starci/grammar/common"
import type { ReactElement } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

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
        readonly breakingHint: string
        readonly isBreaking: boolean
        readonly cardTitle: string
        readonly versionTitle: string
        readonly noPreview: string
        /** The automatic preview failed: only then the card offers the retry. */
        readonly previewFailed: boolean
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

type Props = Pick<AgentTemplatePackageBaseProps, "props" | "on">

/** The card of the template: its text fields in two columns, then the agent's voice. */
const TemplateCard = (props: Props): ReactElement => (
    <SurfaceCard label={props.props.cardTitle} headingLevel={2}>
        <Stack gap="row">
            <Grid kind="form" columns={2}>
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
            </Grid>
            <Textarea
                id="package-soul"
                name="soul"
                label={props.props.soulLabel}
                rows={3}
                value={props.props.soul}
                isDisabled={props.props.isPending}
                onValueChange={props.on.setSoul}
            />
        </Stack>
    </SurfaceCard>
)

/** This version: what changed, and whether people on the old one must read first (a switch, not a text toggle). */
const VersionCard = (props: Props): ReactElement => (
    <SurfaceCard label={props.props.versionTitle} headingLevel={2}>
        <Stack gap="row">
            <Textarea
                id="package-changelog"
                name="changelog"
                label={props.props.changelogLabel}
                rows={3}
                value={props.props.changelog}
                isDisabled={props.props.isPending}
                onValueChange={props.on.setChangelog}
            />
            <Stack gap="identity">
                <Switch
                    name="package-breaking"
                    label={props.props.breakingLabel}
                    isSelected={props.props.isBreaking}
                    isDisabled={props.props.isPending}
                    onSelectedChange={props.on.toggleBreaking}
                />
                <Text size="sm" tone="muted">
                    {props.props.breakingHint}
                </Text>
            </Stack>
        </Stack>
    </SurfaceCard>
)

/** What the package keeps, leaves out and needs, with the way to read it again; it always has its place. */
const PreviewCard = (props: Props): ReactElement => {
    const view = props.props
    return (
        <SurfaceCard
            label={view.previewTitle}
            headingLevel={2}
            {...(view.previewFailed
                ? {
                      labelEnd: (
                          <Button intent="neutral" size="sm" isPending={view.isPending} onPress={props.on.showPreview}>
                              {view.previewLabel}
                          </Button>
                      ),
                  }
                : {})}
        >
            <Stack gap="row">
                {view.preview === undefined ? (
                    <Text size="sm" tone="muted">
                        {view.noPreview}
                    </Text>
                ) : (
                    view.preview.lines.map((line) => (
                        <Text key={line} size="sm">
                            {line}
                        </Text>
                    ))
                )}
                {view.preview === undefined || view.preview.problems.length === 0 ? null : (
                    <Alert tone="negative" title={view.problemsTitle} description={view.preview.problems.join(" | ")} />
                )}
                {view.preview === undefined || view.preview.suggestions.length === 0 ? null : (
                    <>
                        <Text size="sm">{view.suggestionsTitle}</Text>
                        {view.preview.suggestions.map((line) => (
                            <Text key={line} size="xs" tone="muted">
                                {line}
                            </Text>
                        ))}
                    </>
                )}
            </Stack>
        </SurfaceCard>
    )
}

/**
 * Draws the packaging of the process of one agent as one form column: the notice of what the package holds, the card of the template,
 * this version (what changed, and the incompatibility switch), what the package will hold, and the command that saves the next version.
 */
export const AgentTemplatePackageBase = (props: AgentTemplatePackageBaseProps): ReactElement => {
    const view = props.props
    return (
        <Stack gap="region" measure="form">
            <SlotView
                slot={view.slot}
                placeholder="-"
                labels={view.slotLabels}
                onRetry={props.on.retry}
                render={(label, isLoading) => (
                    <Alert
                        tone="informative"
                        title={view.title}
                        description={`${view.note} ${label}`}
                        isLoading={isLoading}
                    />
                )}
            />
            <TemplateCard props={view} on={props.on} />
            <VersionCard props={view} on={props.on} />
            <PreviewCard props={view} on={props.on} />
            <Button
                intent="commit"
                isPending={view.isPending}
                isDisabled={!view.canPackage}
                onPress={props.on.savePackage}
            >
                {view.packageLabel}
            </Button>
        </Stack>
    )
}
