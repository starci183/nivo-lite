import {
    AlertDialog,
    Button,
    Cluster,
    Drawer,
    EmptyNotice,
    Section,
    Stack,
    Stepper,
    Text,
    type ListRowData,
} from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import { nivoIconSource } from "@/components/leaves/Icon"
import { BrainKnowledgeFrame } from "@/components/frames/BrainKnowledgeFrame"
import { DocTruthCard } from "@/components/frames/DocTruthCard"
import { DocUsageCard } from "@/components/frames/DocUsageCard"
import type {
    BrainDocDrawerView,
    BrainDocsCopy,
    BrainDocsView,
    BrainPageHeaderView,
    DataSlot,
    DocTruthControlView,
    DocTruthRowView,
    SlotLabels,
    UsageLimitsView,
} from "@/modules/types"

/** Props for {@link BrainDocumentsBase}. */
export interface BrainDocumentsBaseProps {
    readonly props: Omit<BrainDocsView, "slot" | "placeholder"> & {
        /** The documents as the reads of the list and of the brain settled. */
        readonly slot: DataSlot<ReadonlyArray<DocTruthRowView>>
        readonly placeholder: ReadonlyArray<DocTruthRowView>
        /** The usage block: its meters as the usage read settled, and the same meters with no figures while it loads. */
        readonly usage: DataSlot<UsageLimitsView>
        readonly usagePlaceholder: UsageLimitsView
        readonly truthsCopy: { readonly usageLabel: string; readonly docsLabel: string; readonly view: string }
        readonly copy: BrainDocsCopy
        readonly labels: SlotLabels
        /** The knowledge tab's header: the page heading, its four tabs and the chips. */
        readonly header: BrainPageHeaderView
    }
    readonly on: {
        readonly selectTab: (id: string) => void
        readonly open: (id: string) => void
        readonly view: (id: string) => void
        readonly control: (id: string, kind: DocTruthControlView["kind"]) => void
        readonly close: () => void
        readonly askApprove: (id: string) => void
        readonly cancelApprove: () => void
        readonly confirmApprove: () => void
        readonly retry: () => void
        readonly add: () => void
    }
}

/** The rows of the facts list: the fact and the words of the document, its value at the end, its state and trust. */
const factRowsOf = (drawer: BrainDocDrawerView): ReadonlyArray<ListRowData> =>
    drawer.facts.map((fact) => ({
        id: fact.id,
        title: fact.title,
        ...(fact.quote === null ? {} : { description: fact.quote }),
        badges: [
            { label: fact.state, tone: fact.stateTone },
            { label: fact.trust, tone: fact.trustTone },
        ],
        meta: { text: fact.value },
    }))

/** What the drawer draws. */
interface DrawerProps {
    readonly drawer: BrainDocDrawerView
    readonly copy: BrainDocsCopy
    readonly on: Pick<BrainDocumentsBaseProps["on"], "askApprove" | "close">
}

/** What the footer of the drawer draws. */
interface FooterProps {
    readonly drawer: BrainDocDrawerView
    readonly onApprove: (id: string) => void
}

/** The footer of the drawer: what the approval leaves out, and the approval itself. */
const DrawerFooter = (props: FooterProps) => {
    const { approve, leftOver, id } = props.drawer
    if (approve === null) return null
    return (
        <Cluster gap="row" align="center" justify="end">
            {leftOver === null ? null : (
                <Text size="sm" tone="muted">
                    {leftOver}
                </Text>
            )}
            <Button intent="commit" isPending={approve.isPending} onPress={() => props.onApprove(id)}>
                {approve.label}
            </Button>
        </Cluster>
    )
}

/** The drawer of one document: where it stands on its way in, then the facts it gave. */
const DocDrawer = (props: DrawerProps) => {
    const { drawer, copy } = props
    return (
        <Drawer
            isOpen
            onOpenChange={(isOpen) => {
                if (!isOpen) props.on.close()
            }}
            title={drawer.title}
            description={drawer.description}
            closeLabel={copy.close}
            placement="right"
            width="wide"
            footer={<DrawerFooter drawer={drawer} onApprove={props.on.askApprove} />}
        >
            <Stack gap="section">
                <Stepper
                    label={copy.stepsLabel}
                    currentStepId={drawer.currentStepId}
                    steps={drawer.steps.map((step) => ({
                        id: step.id,
                        label: step.label,
                        description: step.description,
                        state: step.state,
                    }))}
                />
                <Section
                    kind="list"
                    title={drawer.factsTitle}
                    headingLevel={3}
                    count={drawer.factCount}
                    empty={<EmptyNotice message={copy.factsEmpty} iconSource={nivoIconSource("brain", "leading")} />}
                    items={factRowsOf(drawer)}
                />
            </Stack>
        </Drawer>
    )
}

/** What the question asked before approving draws. */
interface ApproveProps {
    readonly confirm: NonNullable<BrainDocsView["confirm"]>
    readonly onCancel: () => void
    readonly onConfirm: () => void
}

/** The question asked before the safe facts of a document are approved together. */
const ApproveDialog = (props: ApproveProps) => (
    <AlertDialog
        isOpen
        onOpenChange={(isOpen) => {
            if (!isOpen) props.onCancel()
        }}
        tone="informative"
        title={props.confirm.title}
        description={props.confirm.description}
        confirmLabel={props.confirm.confirmLabel}
        cancelLabel={props.confirm.cancelLabel}
        onConfirm={props.onConfirm}
    />
)

/**
 * The documents tab of the Second Brain: a full-width table of the documents with the facts each gave, where each stands and when it
 * changed. A row opens a drawer with the way the document takes (put in, read, split into facts, approved, used) and its facts, with
 * the one command that approves the safe ones together after a question. A read that fails or finds nothing is one notice.
 */
export const BrainDocumentsBase = (props: BrainDocumentsBaseProps) => {
    const { copy, labels, slot, placeholder, usage, usagePlaceholder, drawer, confirm, canAdd } = props.props
    return (
        <BrainKnowledgeFrame
            header={props.props.header}
           
            onSelectTab={props.on.selectTab}
        >
            <SlotView
                slot={usage}
                placeholder={usagePlaceholder}
                labels={labels}
                errorDescription={copy.errorBody}
                emptyDescription={copy.emptyBody}
                onRetry={props.on.retry}
                render={(limits, isLoading) => <DocUsageCard limits={limits} isLoading={isLoading} />}
            />
            <SlotView
                slot={slot}
                placeholder={placeholder}
                labels={labels}
                errorDescription={copy.errorBody}
                emptyDescription={copy.emptyBody}
                emptyIconSource={nivoIconSource("brain", "leading")}
                {...(canAdd ? { emptyAction: { label: copy.emptyAction, onAction: props.on.add } } : {})}
                onRetry={props.on.retry}
                render={(rows, isLoading) => (
                    <DocTruthCard
                        rows={rows}
                        isLoading={isLoading}
                        copy={{
                            label: props.props.truthsCopy.docsLabel,
                            view: props.props.truthsCopy.view,
                            emptyTitle: labels.empty,
                            emptyBody: copy.emptyBody,
                        }}
                        onView={props.on.view}
                        onOpen={props.on.open}
                        onControl={props.on.control}
                    />
                )}
            />
            {drawer === null ? null : <DocDrawer drawer={drawer} copy={copy} on={props.on} />}
            {confirm === null ? null : (
                <ApproveDialog
                    confirm={confirm}
                    onCancel={props.on.cancelApprove}
                    onConfirm={props.on.confirmApprove}
                />
            )}
        </BrainKnowledgeFrame>
    )
}
