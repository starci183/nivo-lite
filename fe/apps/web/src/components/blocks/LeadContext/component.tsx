import {
    Alert,
    Badge,
    Button,
    Cluster,
    DescriptionList,
    EmptyNotice,
    Grid,
    Heading,
    Quote,
    Section,
    Stack,
    Text,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { LeadPanel } from "@/components/frames/LeadPanel"
import { SlotView } from "@nivo/agent-sdk/workbench"
import type { LeadIcon, DataSlot, SlotLabels } from "@/modules/types"

/** One line of the AI brief with its glyph. */
export interface BriefLine {
    readonly id: string
    readonly text: string
    readonly icon: LeadIcon
}

/** What the card shows about one lead, all of it already formatted. */
export interface ContextView {
    readonly contact: string
    readonly company: string
    readonly channel: string
    readonly captured: string
    readonly need: string
    readonly hasBrief: boolean
    readonly briefLines: ReadonlyArray<BriefLine>
    readonly briefText: string
    readonly signals: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly statusText: string
    readonly hasConversation: boolean
}

/** The words of the card. */
export interface ContextLabels {
    readonly title: string
    readonly factContact: string
    readonly factCompany: string
    readonly factChannel: string
    readonly factCaptured: string
    readonly customerWords: string
    readonly briefLabel: string
    readonly signalsLabel: string
    readonly aiChip: string
    readonly viewConversation: string
    readonly copy: string
    readonly refresh: string
    readonly noBriefTitle: string
    readonly noBriefHint: string
    readonly prepare: string
    readonly errorTitle: string
    readonly slot: SlotLabels
}

/** The words and state of the customer context card. */
export interface LeadContextBaseProps {
    readonly props: {
        readonly slot: DataSlot<ContextView>
        readonly labels: ContextLabels
        readonly error: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly copy: () => void
        readonly refresh: () => void
    }
}

const PLACEHOLDER: ContextView = {
    contact: "",
    company: "",
    channel: "",
    captured: "",
    need: "",
    hasBrief: false,
    briefLines: [],
    briefText: "",
    signals: [],
    statusText: "",
    hasConversation: false,
}

/** Customer context: the facts, the words, the AI brief with its signals and the refresh and copy actions. */
export const LeadContextBase = (props: LeadContextBaseProps) => {
    const { props: p, on } = props
    const l = p.labels
    return (
        <LeadPanel anchor="context" label={l.title}>
            <SlotView
                slot={p.slot}
                placeholder={PLACEHOLDER}
                labels={l.slot}
                render={(view, isLoading) => renderContextBody({ view, l, on, p, isLoading })}
            />
        </LeadPanel>
    )
}

/** Inputs needed to build the LeadContextContent section. */
interface RenderBriefAndSignalsContext {
    readonly l: ContextLabels
    readonly view: ContextView
}
/** Builds the LeadContextContent section from the current view. */
const renderBriefAndSignals = ({ l, view }: RenderBriefAndSignalsContext) => (
    <>
        <Stack gap="row">
            {view.briefLines.length > 0 ? (
                <Section
                    kind="list"
                    title={l.briefLabel}
                    headingLevel={3}
                    items={view.briefLines.map((line) => ({
                        id: line.id,
                        title: line.text,
                        leading: { icon: nivoIconSource(line.icon, "chip") },
                    }))}
                    empty={<EmptyNotice message={l.noBriefTitle} description={l.noBriefHint} />}
                />
            ) : (
                <Section title={l.briefLabel} headingLevel={3}>
                    <Text>{view.briefText}</Text>
                </Section>
            )}
        </Stack>
        {view.signals.length > 0 ? (
            <Stack gap="row">
                <Heading level={3}>{l.signalsLabel}</Heading>
                <Cluster gap="inline">
                    {view.signals.map((signal) => (
                        <Badge key={signal.id} tone="warning">
                            {signal.label}
                        </Badge>
                    ))}
                </Cluster>
            </Stack>
        ) : null}
    </>
)

/** Inputs needed to build the Stack section. */
interface RenderContextBodyContext {
    readonly view: ContextView
    readonly l: ContextLabels
    readonly on: LeadContextBaseProps["on"]
    readonly p: LeadContextBaseProps["props"]
    readonly isLoading: boolean
}
/** Builds the Stack section from the current view. */
const renderContextBody = ({ view, l, on, p, isLoading }: RenderContextBodyContext) => (
    <Stack gap="region">
        {view.hasBrief ? (
            <Cluster gap="row" justify="between">
                <Cluster gap="inline">
                    <Badge tone="neutral">{l.aiChip}</Badge>
                    <Text size="sm" tone="muted">
                        {view.statusText}
                    </Text>
                </Cluster>
                <Cluster gap="inline">
                    {view.hasConversation ? (
                        <Button intent="neutral" size="sm" href="#history">
                            {l.viewConversation}
                        </Button>
                    ) : null}
                    <Button intent="neutral" size="sm" onPress={on.copy}>
                        {l.copy}
                    </Button>
                    <Button intent="neutral" size="sm" isPending={p.isPending} onPress={on.refresh}>
                        {l.refresh}
                    </Button>
                </Cluster>
            </Cluster>
        ) : null}
        <Grid kind="cards" columns={2}>
            <DescriptionList
                layout="stacked"
                isDivided
                isLoading={isLoading}
                items={[
                    { id: "contact", term: l.factContact, description: view.contact },
                    { id: "company", term: l.factCompany, description: view.company },
                ]}
            />
            <DescriptionList
                layout="stacked"
                isDivided
                isLoading={isLoading}
                items={[
                    { id: "channel", term: l.factChannel, description: view.channel },
                    { id: "captured", term: l.factCaptured, description: view.captured },
                ]}
            />
        </Grid>
        <Stack gap="row">
            <Heading level={3}>{l.customerWords}</Heading>
            <Quote isLoading={isLoading} text={view.need} />
        </Stack>
        {view.hasBrief ? (
            renderBriefAndSignals({ l, view })
        ) : (
            <EmptyNotice
                message={l.noBriefTitle}
                description={l.noBriefHint}
                actionLabel={l.prepare}
                isActionPending={p.isPending}
                onAction={on.refresh}
            />
        )}
        {p.error === null ? null : <Alert tone="negative" title={l.errorTitle} description={p.error} />}
    </Stack>
)
