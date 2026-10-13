import { Button, Input, SectionHeader, SurfaceCard, Text } from "@starci/grammar/common"
import type { ContentT, DownloadFile, PublishStep } from "@/hooks/content"
import { ACTIONS_CLASS_NAME, QUOTE_CLASS_NAME, STEP_CLASS_NAME } from "./classNames"

/** The proof typed for one channel. */
export interface PublishProof {
    readonly url: string
    readonly how: string
}

/** Props of {@link ContentEditorPublish}. */
interface ContentEditorPublishProps {
    readonly steps: ReadonlyArray<PublishStep>
    readonly files: ReadonlyArray<DownloadFile>
    readonly proof: Readonly<Record<string, PublishProof | undefined>>
    readonly canManage: boolean
    readonly isPending: boolean
    readonly busy: string | null
    readonly t: ContentT
    readonly onProof: (channel: string, change: Partial<PublishProof>) => void
    readonly onCopy: (channel: string) => void
    readonly onMark: (channel: string) => void
}

/** The step of an approved post: copy-ready text and downloads per channel, then "mark posted" with a link or a note as proof. */
export const ContentEditorPublish = (props: ContentEditorPublishProps) => (
    <>
        <SectionHeader level={3} title={props.t("postedTitle")} description={props.t("postedBody")} />
        {props.steps.map((step) => {
            const proof = props.proof[step.channel]
            return (
                <SurfaceCard
                    key={step.channel}
                    depth="nested"
                    label={step.label}
                    headingLevel={4}
                    labelEnd={
                        <Text as="span" size="xs" tone="muted">
                            {props.t("comingSoon")}
                        </Text>
                    }
                >
                    <div className={STEP_CLASS_NAME}>
                        {step.isZalo ? (
                            <Text size="xs" tone="muted">
                                {props.t("zaloNote")}
                            </Text>
                        ) : null}
                        <div className={QUOTE_CLASS_NAME}>
                            <Text as="p" size="sm">
                                {step.text}
                            </Text>
                        </div>
                        <div className={ACTIONS_CLASS_NAME}>
                            <Button variant="outline" size="sm" onPress={() => props.onCopy(step.channel)}>
                                {props.t("copy")}
                            </Button>
                            {props.files.map((file) => (
                                <Button key={file.key} variant="outline" size="sm" href={file.url} target="_blank" rel="noreferrer">
                                    {`${props.t("download")}: ${file.name}`}
                                </Button>
                            ))}
                        </div>
                        {step.doneText === null ? null : (
                            <Text size="sm" weight="medium" live="polite">
                                {step.doneText}
                            </Text>
                        )}
                        {step.doneText === null && props.canManage ? (
                            <>
                                <Input
                                    id={`ce-url-${step.channel}`}
                                    name={`url-${step.channel}`}
                                    label={props.t("postedLink")}
                                    variant="secondary"
                                    value={proof?.url ?? ""}
                                    hint={props.t("postedLinkHint")}
                                    isDisabled={props.isPending}
                                    onValueChange={(v) => props.onProof(step.channel, { url: v })}
                                />
                                <Input
                                    id={`ce-how-${step.channel}`}
                                    name={`how-${step.channel}`}
                                    label={props.t("postedHow")}
                                    variant="secondary"
                                    value={proof?.how ?? ""}
                                    isDisabled={props.isPending}
                                    onValueChange={(v) => props.onProof(step.channel, { how: v })}
                                />
                                <div>
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        isPending={props.busy === `posted-${step.channel}`}
                                        isDisabled={props.isPending}
                                        onPress={() => props.onMark(step.channel)}
                                    >
                                        {props.t("markPosted")}
                                    </Button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </SurfaceCard>
            )
        })}
    </>
)
