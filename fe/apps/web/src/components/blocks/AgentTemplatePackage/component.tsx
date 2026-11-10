import { Alert, Button, Cluster, Grid, Input, Select, Stack, SurfaceCard, Switch, Textarea } from "@starci/grammar/common"
import type { ReactElement } from "react"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { DataSlot, SlotLabels } from "@/modules/types"

/** The words of the preview: the rows of what the package keeps, leaves out and needs, and why it is refused. */
interface PreviewView {
    readonly rows: ReadonlyArray<{ readonly id: string; readonly term: string; readonly description: string }>
    readonly problems: ReadonlyArray<string>
    readonly suggestions: ReadonlyArray<string>
}

/** One text field of the form. */
interface FieldView {
    readonly name: string
    readonly label: string
    readonly value: string
    /** One line under the label, when the format needs saying. */
    readonly description?: string
}

/** One choice of the group of the template, with its words in the app's language. */
interface CategoryOption {
    readonly id: string
    readonly label: string
}

/** Copy, values and state the connected packaging form supplies. */
export interface AgentTemplatePackageBaseProps {
    readonly props: {
        readonly slot: DataSlot<string>
        readonly slotLabels: SlotLabels
        readonly title: string
        readonly note: string
        /** The key and the names, in reading order. */
        readonly fields: ReadonlyArray<FieldView>
        /** The summaries, one under the other at the full width of the form. */
        readonly summaries: ReadonlyArray<FieldView>
        readonly categoryLabel: string
        readonly category: string
        readonly categoryOptions: ReadonlyArray<CategoryOption>
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
        /** The three rows before any preview exists: their terms with a dash. */
        readonly emptyRows: PreviewView["rows"]
        readonly canPackage: boolean
        readonly isPending: boolean
    }
    readonly on: {
        readonly retry: () => void
        readonly setField: (name: string, value: string) => void
        readonly setCategory: (value: string) => void
        readonly setSoul: (value: string) => void
        readonly setChangelog: (value: string) => void
        readonly toggleBreaking: () => void
        readonly showPreview: () => void
        readonly savePackage: () => void
    }
}

type Props = Pick<AgentTemplatePackageBaseProps, "props" | "on">

/** The card of the template: key and group, the two names, the two summaries, then the agent's voice, on one form grid. */
const TemplateCard = (props: Props): ReactElement => {
    const view = props.props
    const [key, ...names] = view.fields
    const text = (field: FieldView): ReactElement => (
        <Input
            key={field.name}
            id={`package-${field.name}`}
            name={field.name}
            label={field.label}
            {...(field.description === undefined ? {} : { description: field.description })}
            value={field.value}
            isDisabled={view.isPending}
            onValueChange={(value) => props.on.setField(field.name, value)}
        />
    )
    return (
        <SurfaceCard label={view.cardTitle} headingLevel={2}>
            <Grid kind="form" columns={2}>
                {key === undefined ? null : text(key)}
                <Select
                    key="category"
                    name="category"
                    label={view.categoryLabel}
                    options={view.categoryOptions}
                    value={view.category}
                    isDisabled={view.isPending}
                    onValueChange={(value) => props.on.setCategory(value ?? view.category)}
                />
                {names.map(text)}
                {view.summaries.map((field) => (
                    <Textarea
                        key={field.name}
                        id={`package-${field.name}`}
                        name={field.name}
                        label={field.label}
                        span="full"
                        rows={2}
                        value={field.value}
                        isDisabled={view.isPending}
                        onValueChange={(value) => props.on.setField(field.name, value)}
                    />
                ))}
                <Textarea
                    key="soul"
                    id="package-soul"
                    name="soul"
                    label={view.soulLabel}
                    span="full"
                    rows={3}
                    value={view.soul}
                    isDisabled={view.isPending}
                    onValueChange={props.on.setSoul}
                />
            </Grid>
        </SurfaceCard>
    )
}

/** This version: what changed, and whether people on the old one must set up again (one switch row: title and line at the start, the switch at the end). */
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
            <Switch
                name="package-breaking"
                label={props.props.breakingLabel}
                description={props.props.breakingHint}
                isSelected={props.props.isBreaking}
                isDisabled={props.props.isPending}
                onSelectedChange={props.on.toggleBreaking}
            />
        </Stack>
    </SurfaceCard>
)

/** What the package keeps, leaves out and needs as term and value rows; the problems that refuse it are alerts above, the numbers that could become settings one below. */
const PreviewCard = (props: Props): ReactElement => {
    const view = props.props
    const preview = view.preview
    return (
        <Stack gap="row">
            {preview === undefined
                ? null
                : preview.problems.map((problem) => (
                      <Alert key={problem} tone="negative" title={view.problemsTitle} description={problem} />
                  ))}
            <SurfaceCard
                kind="details"
                label={view.previewTitle}
                headingLevel={2}
                items={preview === undefined ? view.emptyRows : preview.rows}
                {...(preview === undefined ? { note: view.noPreview } : {})}
                {...(view.previewFailed
                    ? {
                          labelEnd: (
                              <Button intent="neutral" size="sm" isPending={view.isPending} onPress={props.on.showPreview}>
                                  {view.previewLabel}
                              </Button>
                          ),
                      }
                    : {})}
            />
            {preview === undefined || preview.suggestions.length === 0 ? null : (
                <Alert tone="informative" title={view.suggestionsTitle} description={preview.suggestions.join(" | ")} />
            )}
        </Stack>
    )
}

/**
 * Draws the packaging of the process of one agent as one form column: the notice of what the package holds, the card of the template,
 * this version (what changed, and the incompatibility switch), what the package will hold, and the one command that saves the next version.
 */
export const AgentTemplatePackageBase = (props: AgentTemplatePackageBaseProps): ReactElement => {
    const view = props.props
    return (
        <Stack gap="region" measure="reading">
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
            <Cluster gap="inline" justify="end">
                <Button
                    intent="commit"
                    isPending={view.isPending}
                    isDisabled={!view.canPackage}
                    onPress={props.on.savePackage}
                >
                    {view.packageLabel}
                </Button>
            </Cluster>
        </Stack>
    )
}
