import {
    Alert,
    Button,
    Checkbox,
    ChoiceChips,
    FileDropzone,
    Form,
    Grid,
    Input,
    Page,
    Stack,
    SurfaceCard,
    Text,
} from "@starci/grammar/common"

import { HiringApplyQuestion } from "@/components/composites/HiringApplyQuestion"
import { HiringJobPost } from "@/components/composites/HiringJobPost"
import { PublicShell } from "@/components/frames/PublicShell"
import type { HiringJobPostProps } from "@/components/composites/HiringJobPost"
import { SlotView } from "@nivo-lite/agent-sdk/client"
import type { ApplyValues, DataSlot, FieldOf, HiringSay, PublicQuestionView, SlotLabels } from "@/modules/types"
import { HONEYPOT_CLASS_NAME } from "./classNames"

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
        /** What a send still lacks, once the candidate pressed it; null when nothing is missing or nothing was pressed. */
        readonly missing: string | null
        readonly isBusy: boolean
        /** The words of the failed submission; null while none failed. */
        readonly submitError: string | null
        readonly doneText: string | null
        readonly language: {
            readonly label: string
            readonly locale: string
            readonly isPending: boolean
            readonly options: ReadonlyArray<{ readonly value: string; readonly label: string; readonly name: string }>
        }
        readonly failedBody: string
    }
    readonly on: {
        readonly text: (name: FieldOf<ApplyValues, string>, value: string) => void
        readonly flag: (name: FieldOf<ApplyValues, boolean>, value: boolean) => void
        readonly list: (name: FieldOf<ApplyValues, Array<string>>, value: Array<string>) => void
        readonly answer: (id: string, answer: string) => void
        readonly cv: (file: File | null) => void
        readonly submit: () => void
        readonly retry: () => void
        readonly chooseLanguage: (locale: string) => void
    }
}

/** Props of the page body: the job (or its blank stand-in) and whether it is drawn as a skeleton. */
interface ApplyBodyProps extends HiringApplyFormBaseProps {
    readonly isSkeleton: boolean
}

/** The apply card: its title outside the card, then the form, the thanks or the line that the post takes no applications. */
const ApplyCard = (props: ApplyBodyProps) => {
    const p = props.props
    const { say } = p
    const isBusy = p.isBusy || props.isSkeleton
    const isOpen = p.isOpen || props.isSkeleton
    return (
        <SurfaceCard label={say("applyTitle")} headingLevel={2} isLoading={props.isSkeleton}>
            <Stack gap="section">
                {isOpen ? null : (
                    <Stack gap="identity">
                        <Text isStrong>{say("applyClosed")}</Text>
                        <Text tone="muted">{say("applyClosedBody", { company: p.company })}</Text>
                    </Stack>
                )}
                {isOpen && p.doneText !== null ? <Alert tone="affirmative" title={p.doneText} /> : null}
                {isOpen && p.doneText === null ? (
                    <Form
                        label={say("applyTitle")}
                        validationBehavior="aria"
                        isPending={isBusy}
                        onSubmit={props.on.submit}
                    >
                        <Stack gap="section">
                            <ApplicantDetails {...props} />
                            <ApplicationSubmission {...props} />
                        </Stack>
                    </Form>
                ) : null}
            </Stack>
        </SurfaceCard>
    )
}

/** The post beside its apply card (the card after the post on a phone). */
const ApplyBody = (props: ApplyBodyProps) => (
    <Grid
        kind="main-rail"
        railPosition="trailing"
        railWidth="wide"
        align="start"
        primary={<HiringJobPost props={props.props.post} isLoading={props.isSkeleton} />}
        rail={<ApplyCard {...props} />}
    />
)

/** Draws the public job page: the post, then the apply form (or a notice when the post takes no applications). */
export const HiringApplyFormBase = (props: HiringApplyFormBaseProps) => (
    <Page chrome="bleed" minHeight="none">
        <PublicShell
            label={props.props.post.title}
            foot={props.props.say("applyFoot", { company: props.props.company })}
            measure="product"
            brand={{
                name: "items" in props.props.slot ? props.props.company : null,
                isLoading: "isLoading" in props.props.slot,
                fallbackLabel: props.props.say("brandFallback"),
            }}
            language={{
                label: props.props.language.label,
                locale: props.props.language.locale,
                isPending: props.props.language.isPending,
                options: props.props.language.options,
            }}
            onChooseLanguage={props.on.chooseLanguage}
        >
            <SlotView
                slot={props.props.slot}
                placeholder
                labels={props.props.slotLabels}
                errorDescription={props.props.failedBody}
                onRetry={props.on.retry}
                render={(_job, isSkeleton) => <ApplyBody {...props} isSkeleton={isSkeleton} />}
            />
        </PublicShell>
    </Page>
)

/** Contact details and availability supplied with an application. */
const ApplicantDetails = (props: ApplyBodyProps) => {
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
                isRequired={values.email.trim() === ""}
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
                <ChoiceChips
                    label={say("applyAvailability")}
                    selectionMode="multiple"
                    isLoading={props.isSkeleton}
                    options={p.availabilityChoices.map((choice) => ({
                        value: choice,
                        label: choice,
                    }))}
                    values={values.availability}
                    onValuesChange={(choices) => on.list("availability", [...choices])}
                    empty={null}
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
const ApplicationSubmission = (props: ApplyBodyProps) => {
    const p = props.props
    const { say, values, isBusy } = p
    const { on } = props
    return (
        <>
            {p.questions.map((question) => (
                <HiringApplyQuestion
                    key={question.id}
                    question={question}
                    say={say}
                    values={values}
                    isBusy={isBusy}
                    onAnswer={on.answer}
                />
            ))}
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
                isLoading={props.isSkeleton}
                label={p.consentText}
                isRequired
                isSelected={values.consent}
                isDisabled={isBusy}
                onSelectedChange={(consent) => on.flag("consent", consent)}
            />
            {p.submitError === null ? null : <Alert tone="negative" title={p.submitError} />}
            {p.missing === null ? null : <Alert tone="negative" title={p.missing} />}
            <Button type="submit" intent="commit" width="fill-narrow" isPending={isBusy}>
                {say("applySubmit")}
            </Button>
            <Text size="xs" tone="muted">
                {say("applyPrivacy")}
            </Text>
        </>
    )
}
