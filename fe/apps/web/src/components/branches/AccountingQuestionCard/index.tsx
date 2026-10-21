import { Alert, Badge, Button, Form, Input, RadioGroup, SurfaceCard, Text, Textarea } from "@starci/grammar/common"
import type { AccountingQuestionCardView } from "@/modules/types"
import { ACTIONS_CLASS_NAME, BODY_CLASS_NAME, FIELDS_CLASS_NAME } from "./classNames"
/** A proposal's settled display data and bound decision actions. */
type AccountingQuestionCardProps = AccountingQuestionCardView

/** Renders a proposal and the owner's decision without legacy office actions. */
export const AccountingQuestionCard = (props: AccountingQuestionCardProps) => (
    <SurfaceCard label={props.props.title}>
        <Form label={props.props.title} isPending={props.props.isBusy} onSubmit={props.on.approve}>
            <div className={BODY_CLASS_NAME}>
                <div className={ACTIONS_CLASS_NAME}>
                    <Badge tone={props.props.statusTone} isDot>
                        {props.props.status}
                    </Badge>
                </div>
                {props.props.explanation ? (
                    <Text size="sm" tone="muted">
                        {props.props.explanation}
                    </Text>
                ) : null}
                {renderAccountingQuestionCardProposal(props)}
                {renderAccountingQuestionEditing(props)}
                {renderAccountingQuestionDetails(props)}
                {props.props.footer ? (
                    <Text size="xs" tone="muted">
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
                        <Button variant="ghost" href={props.props.leadHref}>
                            {props.props.leadLabel}
                        </Button>
                    </div>
                ) : null}
            </div>
        </Form>
    </SurfaceCard>
)

/** Renders the AccountingQuestionCard actions section. */
const renderAccountingQuestionCardActions = (props: NonNullable<AccountingQuestionCardProps>) => (
    <div className={ACTIONS_CLASS_NAME}>
        {!props.props.isFailed ? (
            <Button type="submit" isPending={props.props.isBusy}>
                {props.props.approveLabel}
            </Button>
        ) : null}
        {!props.props.isFailed &&
        props.props.basis === null &&
        (props.props.draft !== null || props.props.amount !== null) ? (
            <Button type="button" variant="outline" isDisabled={props.props.isBusy} onPress={props.on.toggleEdit}>
                {props.props.editLabel}
            </Button>
        ) : null}
        <Button type="button" variant="ghost" isDisabled={props.props.isBusy} onPress={props.on.reject}>
            {props.props.rejectLabel}
        </Button>
    </div>
)

/** Renders the AccountingQuestionCard missing fields section. */
const renderAccountingQuestionCardMissingFields = (props: NonNullable<AccountingQuestionCardProps>) => (
    <div className={FIELDS_CLASS_NAME}>
        <Text size="sm" weight="medium">
            {props.props.missingLabel}
        </Text>
        {props.props.fields.map((field) => (
            <Input
                key={field.name}
                id={`${props.props.id}-${field.name}`}
                name={field.name}
                label={field.label}
                value={field.value}
                isRequired
                isDisabled={props.props.isBusy}
                onValueChange={(value) => props.on.changeField(field.name, value)}
            />
        ))}
    </div>
)

/** Renders the AccountingQuestionCard basis section. */
const renderAccountingQuestionCardBasis = (
    props: AccountingQuestionCardProps,
    basis: NonNullable<AccountingQuestionCardProps["props"]["basis"]>,
) => (
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
        <Text size="xs" tone="muted" weight="medium">
            {props.props.proposalLabel}
        </Text>
        <Text as="p" size="sm">
            {props.props.summary}
        </Text>
    </div>
)

/** Renders the AccountingQuestionCard amount section. */
const renderAccountingQuestionCardAmount = (
    props: AccountingQuestionCardProps,
    amount: NonNullable<AccountingQuestionCardProps["props"]["amount"]>,
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
        {props.props.isOpen && !props.props.isFailed && props.props.fields.length
            ? renderAccountingQuestionCardMissingFields(props)
            : null}
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
