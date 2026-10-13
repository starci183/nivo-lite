import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    EmptyNotice,
    Heading,
    List,
    ListItem,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import { LeadMark } from "@/components/composites/LeadMark"
import { LeadPanel } from "@/components/composites/LeadPanel"
import { SlotView } from "@/components/composites/SlotView"
import type { LeadIcon, DataSlot, SlotLabels } from "@/modules/types"
import {
    CHIPS_CLASS_NAME,
    FACTS_GRID_CLASS_NAME,
    GROUP_CLASS_NAME,
    HEADER_ACTIONS_CLASS_NAME,
    HEADER_CLASS_NAME,
    LIST_CLASS_NAME,
    QUOTE_CLASS_NAME,
    STACK_CLASS_NAME,
} from "./classNames"

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
            <SlotView slot={p.slot} placeholder={PLACEHOLDER} labels={l.slot}>
                {(view, isSkeleton) => (
                    <div className={STACK_CLASS_NAME}>
                        {view.hasBrief ? (
                            <div className={HEADER_CLASS_NAME}>
                                <div className={HEADER_ACTIONS_CLASS_NAME}>
                                    <Badge tone="neutral">{l.aiChip}</Badge>
                                    <Text size="sm" tone="muted">
                                        {view.statusText}
                                    </Text>
                                </div>
                                <div className={HEADER_ACTIONS_CLASS_NAME}>
                                    {view.hasConversation ? (
                                        <Button variant="ghost" size="sm" href="#history">
                                            {l.viewConversation}
                                        </Button>
                                    ) : null}
                                    <Button variant="outline" size="sm" onPress={on.copy}>
                                        {l.copy}
                                    </Button>
                                    <Button variant="outline" size="sm" isPending={p.isPending} onPress={on.refresh}>
                                        {l.refresh}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                        <div className={FACTS_GRID_CLASS_NAME}>
                            <DescriptionList
                                layout="stacked"
                                isDivided
                                isLoading={isSkeleton}
                                items={[
                                    { id: "contact", term: l.factContact, description: view.contact },
                                    { id: "company", term: l.factCompany, description: view.company },
                                ]}
                            />
                            <DescriptionList
                                layout="stacked"
                                isDivided
                                isLoading={isSkeleton}
                                items={[
                                    { id: "channel", term: l.factChannel, description: view.channel },
                                    { id: "captured", term: l.factCaptured, description: view.captured },
                                ]}
                            />
                        </div>
                        <div className={GROUP_CLASS_NAME}>
                            <Heading level={3}>{l.customerWords}</Heading>
                            <SurfaceCard depth="nested">
                                <blockquote className={QUOTE_CLASS_NAME}>
                                    <Text isSkeleton={isSkeleton}>{view.need}</Text>
                                </blockquote>
                            </SurfaceCard>
                        </div>
                        {view.hasBrief ? (
                            <>
                                <div className={GROUP_CLASS_NAME}>
                                    <Heading level={3}>{l.briefLabel}</Heading>
                                    {view.briefLines.length > 0 ? (
                                        <List className={LIST_CLASS_NAME} label={l.briefLabel}>
                                            {view.briefLines.map((line) => (
                                                <ListItem key={line.id}>
                                                    <Text startContent={<LeadMark icon={line.icon} />}>
                                                        {line.text}
                                                    </Text>
                                                </ListItem>
                                            ))}
                                        </List>
                                    ) : (
                                        <Text>{view.briefText}</Text>
                                    )}
                                </div>
                                {view.signals.length > 0 ? (
                                    <div className={GROUP_CLASS_NAME}>
                                        <Heading level={3}>{l.signalsLabel}</Heading>
                                        <div className={CHIPS_CLASS_NAME}>
                                            {view.signals.map((signal) => (
                                                <Badge key={signal.id} tone="warning">
                                                    {signal.label}
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : (
                            <EmptyNotice
                                message={l.noBriefTitle}
                                description={l.noBriefHint}
                                actionLabel={l.prepare}
                                actionVariant="secondary"
                                isActionPending={p.isPending}
                                onAction={on.refresh}
                            />
                        )}
                        {p.error === null ? null : <Alert tone="negative" title={l.errorTitle} description={p.error} />}
                    </div>
                )}
            </SlotView>
        </LeadPanel>
    )
}
