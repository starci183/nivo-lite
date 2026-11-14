import {
    Badge,
    Button,
    ChoiceChips,
    Cluster,
    Freestyle,
    Grid,
    MessageBubble,
    Select,
    Slider,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { BrandColorControl } from "@/components/branches/BrandColorControl"
import type { DataSlot, SlotLabels } from "@/modules/types"
import { previewFrameClassName } from "./classNames"

/** One choice of the font select or of the corner steps. */
interface ChoiceOption {
    readonly id: string
    readonly label: string
}

/** The two modes the preview switch offers. */
type PreviewMode = "light" | "dark"

/** Copy, values and state the connected theme block supplies. */
export interface ThemeSettingsBaseProps {
    readonly props: {
        readonly brandTitle: string
        readonly resetLabel: string
        readonly accent: {
            readonly label: string
            readonly hint: string
            readonly hueLabel: string
            readonly swatchLabel: string
            readonly areaLabel: string
            readonly hexLabel: string
            readonly hex: string
        }
        readonly base: { readonly label: string; readonly hint: string; readonly value: number }
        readonly font: {
            readonly label: string
            readonly placeholder: string
            readonly value: string
            readonly options: ReadonlyArray<ChoiceOption>
        }
        readonly radius: {
            readonly label: string
            readonly empty: string
            readonly value: string
            readonly options: ReadonlyArray<ChoiceOption>
        }
        readonly contrastNote: string
        readonly saveLabel: string
        readonly isPending: boolean
        /** Owner and manager change the theme; everyone else sees the preview of what the workspace wears. */
        readonly canEdit: boolean
        readonly readOnlyNote: string
        readonly preview: {
            readonly title: string
            readonly modeLabel: string
            readonly mode: PreviewMode
            readonly modeItems: readonly [ChoiceOption, ChoiceOption]
            /** The class of the frame and the stylesheet that paints the draft inside it (the console around it keeps its own colours). */
            readonly scopeClass: string
            readonly scopeCss: string
            readonly rowTitle: string
            readonly rowText: string
            readonly badge: string
            readonly primary: string
            readonly secondary: string
            readonly botLine: string
            readonly customerLine: string
        }
        readonly slot: DataSlot<true>
        readonly labels: SlotLabels
    }
    readonly on: {
        readonly setAccentHex: (hex: string) => void
        readonly setBase: (value: number) => void
        readonly setFont: (value: string) => void
        readonly setRadius: (value: string) => void
        readonly setMode: (value: PreviewMode) => void
        readonly reset: () => void
        readonly save: () => void
        readonly retry: () => void
    }
}

/** What a card of the block draws: the block's props and whether the read is still waiting. */
type CardProps = ThemeSettingsBaseProps & { readonly isSkeleton: boolean }

/** The note on the text colour, then the one save command (a member who cannot change the theme reads a note instead). */
const SaveFoot = (props: CardProps) => (
    <Stack gap="row">
        <Text size="xs" tone="muted">
            {props.props.contrastNote}
        </Text>
        {props.props.canEdit ? (
            <Cluster gap="inline" justify="end">
                <Button
                    intent="commit"
                    startGlyph="success"
                    isPending={props.props.isPending}
                    isLoading={props.isSkeleton}
                    onPress={props.on.save}
                >
                    {props.props.saveLabel}
                </Button>
            </Cluster>
        ) : (
            <Text size="xs" tone="muted">
                {props.props.readOnlyNote}
            </Text>
        )}
    </Stack>
)

/** The head of the brand card: the one small command that returns to the NIVO default. */
const ResetHead = (props: CardProps) => (
    <Cluster gap="inline" justify="end">
        <Button
            size="sm"
            intent="neutral"
            isDisabled={props.props.isPending || !props.props.canEdit}
            onPress={props.on.reset}
        >
            {props.props.resetLabel}
        </Button>
    </Cluster>
)

/** The brand card: the accent control, the base, the font and the corners. */
const BrandCard = (props: CardProps) => {
    const locked = props.props.isPending || !props.props.canEdit
    return (
        <SurfaceCard
            label={props.props.brandTitle}
            headingLevel={2}
            isLoading={props.isSkeleton}
            headers={props.props.canEdit ? [{ kind: "custom", children: <ResetHead {...props} /> }] : []}
            footers={[{ kind: "custom", children: <SaveFoot {...props} /> }]}
        >
            <Stack gap="section">
                <BrandColorControl {...props.props.accent} isDisabled={locked} onChange={props.on.setAccentHex} />
                <Slider
                    label={props.props.base.label}
                    description={props.props.base.hint}
                    minValue={0}
                    maxValue={1}
                    step={0.01}
                    value={props.props.base.value}
                    isDisabled={locked}
                    isLoading={props.isSkeleton}
                    onValueChange={(value) => props.on.setBase(typeof value === "number" ? value : (value[0] ?? 0))}
                />
                <Select
                    label={props.props.font.label}
                    placeholder={props.props.font.placeholder}
                    options={props.props.font.options}
                    value={props.props.font.value}
                    isDisabled={locked}
                    isLoading={props.isSkeleton}
                    onValueChange={(value) => {
                        if (value !== null) props.on.setFont(value)
                    }}
                />
                <ChoiceChips
                    label={props.props.radius.label}
                    empty={props.props.radius.empty}
                    width="fill"
                    options={props.props.radius.options.map((option) => ({ value: option.id, label: option.label }))}
                    value={props.props.radius.value}
                    isLoading={props.isSkeleton}
                    onValueChange={props.on.setRadius}
                />
            </Stack>
        </SurfaceCard>
    )
}

/** The props of PreviewSample. */
interface PreviewSampleProps {
    readonly preview: ThemeSettingsBaseProps["props"]["preview"]
}

/** The sample the preview paints: a row with a badge, two buttons and a website chat bubble pair. */
const PreviewSample = (props: PreviewSampleProps) => {
    const preview = props.preview
    return (
        <Stack gap="section">
            <Stack gap="inline">
                <Cluster gap="identity" justify="between">
                    <Text>{preview.rowTitle}</Text>
                    <Badge tone="accent">{preview.badge}</Badge>
                </Cluster>
                <Text size="xs" tone="muted">
                    {preview.rowText}
                </Text>
            </Stack>
            <Cluster gap="inline">
                <Button intent="commit">{preview.primary}</Button>
                <Button intent="neutral">{preview.secondary}</Button>
            </Cluster>
            <Stack gap="inline">
                <MessageBubble side="incoming" body={preview.botLine} />
                <MessageBubble side="outgoing" body={preview.customerLine} />
            </Stack>
        </Stack>
    )
}

/** The preview card: a Light / Dark switch, then the sample painted with the draft inside its own scope. */
const PreviewCard = (props: CardProps) => {
    const preview = props.props.preview
    return (
        <SurfaceCard
            label={preview.title}
            headingLevel={2}
            isLoading={props.isSkeleton}
            headers={[
                {
                    kind: "switch",
                    label: preview.modeLabel,
                    items: preview.modeItems,
                    selectedKey: preview.mode,
                    onSelect: (key) => props.on.setMode(key === "dark" ? "dark" : "light"),
                },
            ]}
        >
            <style>{preview.scopeCss}</style>
            <Freestyle
                reason="the preview paints the draft theme's own colours inside its frame, which no Grammar surface offers"
                className={previewFrameClassName(preview.scopeClass, preview.mode)}
            >
                <div inert>
                    <PreviewSample preview={preview} />
                </div>
            </Freestyle>
        </SurfaceCard>
    )
}

/**
 * Draws the theme tab as two cards side by side: the brand card (the accent control of the HeroUI theme builder, the base, the font, the
 * corners, then the note on the text colour and the one save command) and a live preview in Light or Dark. Both are geometry while the
 * theme loads.
 */
export const ThemeSettingsBase = (props: ThemeSettingsBaseProps) => (
    <SlotView
        slot={props.props.slot}
        placeholder
        labels={props.props.labels}
        onRetry={props.on.retry}
        render={(_, isSkeleton) => (
            <Grid kind="cards" columns={2} align="start">
                <BrandCard {...props} isSkeleton={isSkeleton} />
                <PreviewCard {...props} isSkeleton={isSkeleton} />
            </Grid>
        )}
    />
)
