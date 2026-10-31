import {
    Alert,
    Badge,
    Button,
    Cluster,
    Form,
    Input,
    RadioGroup,
    Stack,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { AccountingMissingFields } from "@/components/leaves/AccountingMissingFields"
import type { AccountingQuestionCardView } from "@/modules/types"
/** A proposal's settled display data and bound decision actions; `isSkeleton` draws its leaves as skeleton while it is a placeholder. */
interface AccountingQuestionCardProps extends AccountingQuestionCardView {
    readonly isSkeleton: boolean
}

/** Renders a proposal and the owner's decision without legacy office actions. */
export const AccountingQuestionCard = (props: AccountingQuestionCardProps) => {
    return (
        <SurfaceCard label={props.props.title}>
            <Form label={props.props.title} isPending={props.props.isBusy} onSubmit={props.on.approve}>
                <Stack gap="section">
                    <Cluster gap="inline">
                        <Badge tone={props.props.statusTone} isDot isSkeleton={props.isSkeleton}>
                            {props.props.status}
                        </Badge>
                    </Cluster>
                    {props.props.explanation ? (
                        <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                            {props.props.explanation}
                        </Text>
                    ) : null}
                    {renderAccountingQuestionCardProposal(props)}
                    {renderAccountingQuestionEditing(props)}
                    {renderAccountingQuestionDetails(props)}
                    {props.props.footer ? (
                        <Text size="xs" tone="muted" isSkeleton={props.isSkeleton}>
                            {props.props.footer}
                        </Text>
                    ) : null}
                    {props.props.error ? <Alert tone="negative" title={props.props.error} /> : null}
                    {props.props.isOpen && !props.props.canAct ? (
                        <Text size="sm" weight="medium">
                            {props.props.waitingLabel}
                        </Text>
                    ) : null}
                    {props.props.isOpen && props.props.canAct ? renderAccountingQuestionCardActions(props) : null}
                    {props.props.leadHref ? (
                        <div>
                            <Button intent="neutral" href={props.props.leadHref}>
                                {props.props.leadLabel}
                            </Button>
                        </div>
                    ) : null}
                </Stack>
            </Form>
        </SurfaceCard>
    )
}

/** Renders the AccountingQuestionCard actions section. */
const renderAccountingQuestionCardActions = (props: NonNullable<AccountingQuestionCardProps>) => (
    <Cluster gap="inline">
        {!props.props.isFailed ? (
            <Button intent="commit" type="submit" isPending={props.props.isBusy} isSkeleton={props.isSkeleton}>
                {props.props.approveLabel}
            </Button>
        ) : null}
        {!props.props.isFailed &&
        props.props.basis === null &&
        (props.props.draft !== null || props.props.amount !== null) ? (
            <Button
                type="button"
                intent="neutral"
                isDisabled={props.props.isBusy}
                isSkeleton={props.isSkeleton}
                onPress={props.on.toggleEdit}
            >
                {props.props.editLabel}
            </Button>
        ) : null}
        <Button
            type="button"
            intent="alternative"
            isDisabled={props.props.isBusy}
            isSkeleton={props.isSkeleton}
            onPress={props.on.reject}
        >
            {props.props.rejectLabel}
        </Button>
    </Cluster>
)

/** Renders the AccountingQuestionCard basis section. */
const renderAccountingQuestionCardBasis = (props: Pick<AccountingQuestionCardProps, "props" | "on">, basis: string) => (
    <Textarea
        id={`${props.props.id}-basis`}
        label={props.props.basisLabel}
        description={props.props.basisHint}
        placeholder={props.props.basisPlaceholder}
        isRequired
        rows={2}
        value={basis}
        isDisabled={props.props.isBusy}
        onValueChange={props.on.changeBasis}
    />
)

/** Renders the AccountingQuestionCard proposal section. */
const renderAccountingQuestionCardProposal = (props: NonNullable<AccountingQuestionCardProps>) => (
    <div>
        <Text size="xs" tone="muted" weight="medium" isSkeleton={props.isSkeleton}>
            {props.props.proposalLabel}
        </Text>
        <Text as="p" size="sm" isSkeleton={props.isSkeleton}>
            {props.props.summary}
        </Text>
    </div>
)

/** Renders the AccountingQuestionCard amount section. */
const renderAccountingQuestionCardAmount = (
    props: Pick<AccountingQuestionCardProps, "props" | "on">,
    amount: string,
) => (
    <Input
        id={`${props.props.id}-amount`}
        name="amount"
        label={props.props.amountLabel}
        value={amount}
        isDisabled={props.props.isBusy}
        onValueChange={props.on.changeAmount}
    />
)

/** The editable draft and amount share the proposal editing state. */
const renderAccountingQuestionEditing = (props: AccountingQuestionCardProps) => (
    <>
        {props.props.draft !== null && !props.props.isEditing ? (
            <Text size="sm" tone="muted">
                {props.props.draft}
            </Text>
        ) : null}
        {props.props.isOpen && props.props.isEditing && props.props.draft !== null ? (
            <Textarea
                label={props.props.draftLabel}
                rows={4}
                value={props.props.draft}
                isDisabled={props.props.isBusy}
                onValueChange={props.on.changeDraft}
            />
        ) : null}
        {props.props.isOpen && props.props.isEditing && props.props.amount !== null
            ? renderAccountingQuestionCardAmount(props, props.props.amount)
            : null}
    </>
)

/** Pending reconciliation, missing fields and candidate choices. */
const renderAccountingQuestionDetails = (props: AccountingQuestionCardProps) => (
    <>
        {props.props.isOpen && !props.props.isFailed && props.props.fields.length ? (
            <AccountingMissingFields
                id={props.props.id}
                label={props.props.missingLabel}
                fields={props.props.fields}
                isBusy={props.props.isBusy}
                onChange={props.on.changeField}
            />
        ) : null}
        {props.props.isOpen && !props.props.isFailed && props.props.reconcileCredit !== null ? (
            <div>
                <Text size="sm">{props.props.reconcileCredit}</Text>
                <Text size="sm" tone="muted">
                    {props.props.reconcileWarning}
                </Text>
            </div>
        ) : null}
        {props.props.isOpen && !props.props.isFailed && props.props.candidates.length ? (
            <RadioGroup
                label={props.props.candidateLabel}
                value={props.props.candidateId || null}
                isDisabled={props.props.isBusy}
                options={props.props.candidates}
                onValueChange={props.on.changeCandidate}
            />
        ) : null}
        {props.props.isOpen && !props.props.isFailed && props.props.basis !== null
            ? renderAccountingQuestionCardBasis(props, props.props.basis)
            : null}
    </>
)
