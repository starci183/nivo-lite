import {
    Alert,
    Button,
    Checkbox,
    CheckboxGroup,
    FileDropzone,
    Form,
    Heading,
    Input,
    RadioGroup,
    SurfaceCard,
    Text,
    Textarea,
} from "@starci/grammar/common"
import { HiringJobPost } from "@/components/composites/HiringJobPost"
import type { HiringJobPostProps } from "@/components/composites/HiringJobPost"
import { SlotView } from "@/components/composites/SlotView"
import type { ApplyValues, DataSlot, FieldOf, HiringSay, PublicQuestionView, SlotLabels } from "@/modules/types"
import { CARD_CLASS_NAME, FOOT_CLASS_NAME, HONEYPOT_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** What the connected block settled for the public job page. */
export interface HiringApplyFormBaseProps {
    readonly props: {
        readonly say: HiringSay
        /** The public job read: the page draws from the other fields, which are blank until it lands. */
        readonly slot: DataSlot<true>
        readonly slotLabels: SlotLabels
        readonly post: HiringJobPostProps["props"]
        readonly company: string
        readonly isOpen: boolean
        readonly consentText: string
        readonly questions: ReadonlyArray<PublicQuestionView>
        readonly availabilityChoices: ReadonlyArray<string>
        readonly values: ApplyValues
        readonly cvAccept: string
        readonly cvError: string | undefined
        readonly canSubmit: boolean
        readonly isBusy: boolean
        /** The words of the failed submission; null while none failed. */
        readonly failure: string | null
        readonly doneText: string | null
    }
    readonly on: {
        readonly text: (name: FieldOf<ApplyValues, string>, value: string) => void
        readonly flag: (name: FieldOf<ApplyValues, boolean>, value: boolean) => void
        readonly list: (name: FieldOf<ApplyValues, Array<string>>, value: Array<string>) => void
        readonly answer: (id: string, answer: string) => void
        readonly cv: (file: File | null) => void
        readonly submit: () => void
        readonly retry: () => void
    }
}

const questionField = (question: PublicQuestionView, props: HiringApplyFormBaseProps) => {
    const { say, values, isBusy } = props.props
    const answer = values.answers[question.id] ?? ""
    const common = { label: question.text, isRequired: question.required, isDisabled: isBusy }
    const set = (value: string) => props.on.answer(question.id, value)
    if (question.type === "yesno") {
        return (
            <RadioGroup
                key={question.id}
                {...common}
                name={`q_${question.id}`}
                orientation="horizontal"
                options={[
                    { value: say("yes"), label: say("yes") },
                    { value: say("no"), label: say("no") },
                ]}
                value={answer === "" ? null : answer}
                onValueChange={set}
            />
        )
    }
    if (question.type === "choice") {
        return (
            <RadioGroup
                key={question.id}
                {...common}
                name={`q_${question.id}`}
                options={question.choices.map((choice) => ({ value: choice, label: choice }))}
                value={answer === "" ? null : answer}
                onValueChange={set}
            />
        )
    }
    if (question.type === "number") {
        return (
            <Input
                key={question.id}
                id={`apply-q-${question.id}`}
                name={`q_${question.id}`}
                {...common}
                value={answer}
                onValueChange={set}
            />
        )
    }
    return (
        <Textarea
            key={question.id}
            {...common}
            name={`q_${question.id}`}
            rows={3}
            maxLength={1000}
            value={answer}
            onValueChange={set}
        />
    )
}

/** Props of the page body: the job (or its blank stand-in) and whether it is drawn as a skeleton. */
interface ApplyBodyProps extends HiringApplyFormBaseProps {
    readonly isSkeleton: boolean
}

/** The post and its apply card; while the job is read the form draws blank and disabled. */
const ApplyBody = (props: ApplyBodyProps) => {
    const p = props.props
    const { say } = p
    const { on } = props
    const isBusy = p.isBusy || props.isSkeleton
    const isOpen = p.isOpen || props.isSkeleton
    return (
        <div className={STACK_CLASS_NAME}>
            <HiringJobPost props={p.post} />
            <SurfaceCard ariaLabel={say(isOpen ? "applyTitle" : "applyClosed")}>
                <div className={CARD_CLASS_NAME}>
                    {isOpen ? null : <Heading level={2}>{say("applyClosed")}</Heading>}
                    {isOpen ? (
                        <Heading level={2} isSkeleton={props.isSkeleton}>
                            {say("applyTitle")}
                        </Heading>
                    ) : null}
                    {isOpen ? null : <Text tone="muted">{say("applyClosedBody", { company: p.company })}</Text>}
                    {isOpen && p.doneText !== null ? <Alert tone="affirmative" title={p.doneText} /> : null}
                    {isOpen && p.doneText === null ? (
                        <Form
                            label={say("applyTitle")}
                            validationBehavior="aria"
                            isPending={isBusy}
                            onSubmit={on.submit}
                        >
                            <div className={CARD_CLASS_NAME}>
                                <ApplicantDetails {...props} />
                                <ApplicationSubmission {...props} />{" "}
                            </div>
                        </Form>
                    ) : null}
                </div>
            </SurfaceCard>
            <div className={FOOT_CLASS_NAME}>
                <Text size="xs">{say("applyFoot", { company: p.company })}</Text>
            </div>
        </div>
    )
}

/** Draws the public job page: the post, then the apply form (or a notice when the post takes no applications). */
export const HiringApplyFormBase = (props: HiringApplyFormBaseProps) => (
    <SlotView slot={props.props.slot} placeholder labels={props.props.slotLabels} onRetry={props.on.retry}>
        {(_job, isSkeleton) => <ApplyBody {...props} isSkeleton={isSkeleton} />}
    </SlotView>
)

/** Contact details and availability supplied with an application. */
const ApplicantDetails = (props: HiringApplyFormBaseProps) => {
    const p = props.props
    const { say, values, isBusy } = p
    const { on } = props
    return (
        <>
            <Input
                id="apply-name"
                name="name"
                label={say("applyName")}
                isRequired
                isDisabled={isBusy}
                value={values.name}
                onValueChange={(name) => on.text("name", name)}
            />
            <Input
                id="apply-phone"
                name="phone"
                label={say("applyPhone")}
                description={say("applyPhoneHint")}
                isRequired
                isDisabled={isBusy}
                value={values.phone}
                onValueChange={(phone) => on.text("phone", phone)}
            />
            <Input
                id="apply-email"
                name="email"
                kind="email"
                label={say("applyEmail")}
                isDisabled={isBusy}
                value={values.email}
                onValueChange={(email) => on.text("email", email)}
            />
            {p.availabilityChoices.length > 0 ? (
                <CheckboxGroup
                    label={say("applyAvailability")}
                    name="availability"
                    options={p.availabilityChoices.map((choice) => ({
                        value: choice,
                        label: choice,
                    }))}
                    value={values.availability}
                    isDisabled={isBusy}
                    onValueChange={(choices) => on.list("availability", choices)}
                />
            ) : (
                <Input
                    id="apply-availability"
                    name="availability"
                    label={say("applyAvailabilityText")}
                    isDisabled={isBusy}
                    value={values.availabilityText}
                    onValueChange={(text) => on.text("availabilityText", text)}
                />
            )}
        </>
    )
}

/** Questions, CV, consent and submission feedback. */
const ApplicationSubmission = (props: HiringApplyFormBaseProps) => {
    const p = props.props
    const { say, values, isBusy } = p
    const { on } = props
    return (
        <>
            {p.questions.map((question) => questionField(question, props))}
            <FileDropzone
                label={say("applyCv")}
                name="cv"
                accept={p.cvAccept}
                description={say("applyCvHint")}
                isDisabled={isBusy}
                prompt={say("applyCvPrompt")}
                errorMessage={p.cvError}
                onFilesChange={(files) => on.cv(files[0] ?? null)}
            />
            <div className={HONEYPOT_CLASS_NAME} inert>
                <Input
                    id="apply-website"
                    name="website"
                    label={say("applyWebsite")}
                    value={values.website}
                    onValueChange={(website) => on.text("website", website)}
                />
            </div>
            <Checkbox
                name="consent"
                label={say("applyConsent")}
                description={p.consentText}
                isRequired
                isSelected={values.consent}
                isDisabled={isBusy}
                onSelectedChange={(consent) => on.flag("consent", consent)}
            />
            {p.failure === null ? null : <Alert tone="negative" title={p.failure} />}
            <Button type="submit" intent="commit" isPending={isBusy} isDisabled={isBusy || !p.canSubmit}>
                {say("applySubmit")}
            </Button>
            <Text size="xs" tone="muted">
                {say("applyPrivacy")}
            </Text>
        </>
    )
}
