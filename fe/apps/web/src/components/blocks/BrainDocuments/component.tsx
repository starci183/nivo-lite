import {
    AlertDialog,
    Badge,
    Button,
    Cluster,
    Drawer,
    EmptyNotice,
    Section,
    Stack,
    Stepper,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { ReactNode } from "react"
import { nivoIconSource } from "@/components/leaves/Icon"
import { BrainKnowledgeFrame } from "@/components/frames/BrainKnowledgeFrame"
import type { BrainDocDrawerView, BrainDocRowView, BrainDocsCopy, BrainDocsView, BrainPageHeaderView, SlotLabels } from "@/modules/types"

/** Props for {@link BrainDocumentsBase}. */
export interface BrainDocumentsBaseProps {
    readonly props: BrainDocsView & {
        readonly copy: BrainDocsCopy
        readonly labels: SlotLabels
        /** The knowledge tab's header: the page heading, its four tabs and the chips. */
        readonly header: BrainPageHeaderView
    }
    readonly on: {
        readonly reviewAll: () => void
        readonly selectTab: (id: string) => void
        readonly open: (id: string) => void
        readonly close: () => void
        readonly askApprove: (id: string) => void
        readonly cancelApprove: () => void
        readonly confirmApprove: () => void
        readonly retry: () => void
        readonly add: () => void
    }
}

/** What the name, status and date cells draw: the row, and whether it is a placeholder. */
interface CellProps {
    readonly row: BrainDocRowView
    readonly isLoading: boolean
}

/** What the facts cell draws: the row, the words for no facts, and whether the row is a placeholder. */
interface FactsCellProps extends CellProps {
    readonly none: string
}

/** The facts column: what waits for the owner, then what is approved; the words for none when the document gave nothing. */
const FactsCell = (props: FactsCellProps) => {
    const { row, isLoading } = props
    if (row.proposed === null && row.approved === null)
        return (
            <Text size="sm" tone="muted" isLoading={isLoading}>
                {props.none}
            </Text>
        )
    return (
        <Cluster gap="inline" align="center">
            {row.proposed === null ? null : (
                <Badge tone="warning" isLoading={isLoading}>
                    {row.proposed}
                </Badge>
            )}
            {row.approved === null ? null : (
                <Text size="sm" tone="muted" isLoading={isLoading}>
                    {row.approved}
                </Text>
            )}
        </Cluster>
    )
}

/** The name column: the document with its kind under it. */
const NameCell = (props: CellProps) => (
    <Stack gap="inline">
        <Text isStrong isLoading={props.isLoading}>
            {props.row.title}
        </Text>
        <Text size="sm" tone="muted" isLoading={props.isLoading}>
            {props.row.kind}
        </Text>
    </Stack>
)

/** One cell of the table, by column. */
const cellOf = (columnId: string, cell: CellProps, none: string): ReactNode => {
    if (columnId === "facts") return <FactsCell row={cell.row} none={none} isLoading={cell.isLoading} />
    if (columnId === "status")
        return (
            <Badge tone={cell.row.statusTone} isLoading={cell.isLoading}>
                {cell.row.status}
            </Badge>
        )
    if (columnId === "updated")
        return (
            <Text size="sm" tone="muted" isLoading={cell.isLoading}>
                {cell.row.updated}
            </Text>
        )
    return <NameCell {...cell} />
}

/** The columns of the table, in order. */
const COLUMN_IDS = ["name", "facts", "status", "updated"]

/** What the table draws. */
interface TableProps {
    readonly rows: ReadonlyArray<BrainDocRowView>
    readonly isLoading: boolean
    readonly copy: BrainDocsCopy
    readonly emptyTitle: string
    readonly onOpen: (id: string) => void
}

/** The table of documents as one card, full width, one row each; a row opens the drawer. */
const Table = (props: TableProps) => {
    const { copy } = props
    return (
        <SurfaceCard
            kind="table"
            ariaLabel={copy.tableLabel}
            isLoading={props.isLoading}
            columns={[
                { id: "name", label: copy.columns.name },
                { id: "facts", label: copy.columns.facts },
                { id: "status", label: copy.columns.status, priority: "low" },
                { id: "updated", label: copy.columns.updated, priority: "low" },
            ]}
            rows={props.rows.map((row) => ({
                id: row.id,
                cells: Object.fromEntries(
                    COLUMN_IDS.map((columnId) => [columnId, cellOf(columnId, { row, isLoading: props.isLoading }, copy.noFacts)]),
                ),
            }))}
            onRowAction={props.onOpen}
            empty={<EmptyNotice message={props.emptyTitle} iconSource={nivoIconSource("document", "leading")} description={copy.emptyBody} />}
        />
    )
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
    const { copy, labels, slot, placeholder, drawer, confirm, canAdd } = props.props
    return (
        <BrainKnowledgeFrame header={props.props.header} onReviewAll={props.on.reviewAll} onSelectTab={props.on.selectTab}>
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
                    <Table
                        rows={rows}
                        isLoading={isLoading}
                        copy={copy}
                        emptyTitle={labels.empty}
                        onOpen={props.on.open}
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
