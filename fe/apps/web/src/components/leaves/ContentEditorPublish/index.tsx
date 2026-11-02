import { Button, Cluster, Input, Quote, Stack, Text, Section } from "@starci/grammar/common"
import type { DownloadFile, PublishStep, ContentViews } from "@/modules/types"

/** Props of {@link ContentEditorPublish}. */
interface ContentEditorPublishProps {
    readonly steps: ReadonlyArray<PublishStep>
    readonly files: ReadonlyArray<DownloadFile>
    readonly proof: Readonly<Record<string, ContentViews["publishProof"] | undefined>>
    readonly canManage: boolean
    readonly isPending: boolean
    readonly busy: string | null
    readonly copy: ContentViews["workbenchCopy"]
    readonly onProof: (channel: string, change: Partial<ContentViews["publishProof"]>) => void
    readonly onCopy: (channel: string) => void
    readonly onMark: (channel: string) => void
}

/** The step of an approved post: copy-ready text and downloads per channel, then "mark posted" with a link or a note as proof. */
export const ContentEditorPublish = (props: ContentEditorPublishProps) => (
    <Section title={props.copy.postedTitle} description={props.copy.postedBody} headingLevel={3}>
        {props.steps.map((step) => {
            const proof = props.proof[step.channel]
            return (
                <Section key={step.channel} title={step.label} headingLevel={4} meta={props.copy.comingSoon}>
                    <Stack gap="row">
                        {step.isZalo ? (
                            <Text size="xs" tone="muted">
                                {props.copy.zaloNote}
                            </Text>
                        ) : null}
                        <Quote source={step.label} text={step.text} />
                        <Cluster gap="inline">
                            <Button intent="neutral" size="sm" onPress={() => props.onCopy(step.channel)}>
                                {props.copy.copy}
                            </Button>
                            {props.files.map((file) => (
                                <Button
                                    key={file.key}
                                    intent="neutral"
                                    size="sm"
                                    href={file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    {`${props.copy.download}: ${file.name}`}
                                </Button>
                            ))}
                        </Cluster>
                        {step.doneText === null ? null : (
                            <Text size="sm" isStrong live="polite">
                                {step.doneText}
                            </Text>
                        )}
                        {step.doneText === null && props.canManage
                            ? renderContentEditorPublishProofFields(step, props, proof)
                            : null}
                    </Stack>
                </Section>
            )
        })}
    </Section>
)

/** Renders the ContentEditorPublish proof fields section. */
const renderContentEditorPublishProofFields = (
    step: Pick<PublishStep, "channel">,
    props: ContentEditorPublishProps,
    proof: ContentViews["publishProof"] | undefined,
) => (
    <>
        <Input
            id={`ce-url-${step.channel}`}
            name={`url-${step.channel}`}
            label={props.copy.postedLink}
            value={proof?.url ?? ""}
            description={props.copy.postedLinkHint}
            isDisabled={props.isPending}
            onValueChange={(v) => props.onProof(step.channel, { url: v })}
        />
        <Input
            id={`ce-how-${step.channel}`}
            name={`how-${step.channel}`}
            label={props.copy.postedHow}
            value={proof?.how ?? ""}
            isDisabled={props.isPending}
            onValueChange={(v) => props.onProof(step.channel, { how: v })}
        />
        <div>
            <Button
                intent="neutral"
                size="sm"
                isPending={props.busy === `posted-${step.channel}`}
                isDisabled={props.isPending}
                onPress={() => props.onMark(step.channel)}
            >
                {props.copy.markPosted}
            </Button>
        </div>
    </>
)
