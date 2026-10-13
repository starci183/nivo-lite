import { Alert, Badge, Button, EmptyNotice, Heading, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { HiringJobAdDialog } from "@/components/composites/HiringJobAdDialog"
import type { HiringJobAdDialogProps } from "@/components/composites/HiringJobAdDialog"
import { HiringJobEditorDialog } from "@/components/composites/HiringJobEditorDialog"
import type { HiringJobEditorDialogProps } from "@/components/composites/HiringJobEditorDialog"
import type { FieldOf, HiringSay } from "@/hooks/hiring"
import type { HiringJobValues, HiringQuestionValues } from "@/hooks/hiringJobs"
import { ACTIONS_CLASS_NAME, FACTS_CLASS_NAME, HEAD_CLASS_NAME } from "./classNames"

/** One job row, every word already resolved. */
interface JobRowView {
    readonly id: string
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly facts: string
    readonly counts: string
    readonly publicUrl: string | null
    readonly copyLabel: string | null
    readonly transitions: ReadonlyArray<{ readonly to: string; readonly label: string; readonly isPrimary: boolean }>
}

/** What the connected block settled for the jobs tab. */
export interface HiringJobsBaseProps {
    readonly props: {
        readonly say: HiringSay
        readonly fact: string
        readonly rows: ReadonlyArray<JobRowView>
        readonly isBusy: boolean
        readonly error: string | null
        readonly isEditorOpen: boolean
        readonly editor: HiringJobEditorDialogProps["props"]
        readonly isAdOpen: boolean
        readonly ad: HiringJobAdDialogProps["props"]
    }
    readonly on: {
        readonly create: () => void
        readonly edit: (id: string) => void
        readonly openAd: (id: string) => void
        readonly openPipeline: (id: string) => void
        readonly copy: (id: string) => void
        readonly transition: (id: string, to: string) => void
        readonly editorText: (name: FieldOf<HiringJobValues, string>, value: string) => void
        readonly editorNumber: (name: FieldOf<HiringJobValues, number | null>, value: number | null) => void
        readonly editorList: (name: FieldOf<HiringJobValues, Array<string>>, value: Array<string>) => void
        readonly patchQuestion: (index: number, patch: Partial<HiringQuestionValues>) => void
        readonly addQuestion: () => void
        readonly removeQuestion: (index: number) => void
        readonly saveEditor: () => void
        readonly closeEditor: () => void
        readonly generateAd: () => void
        readonly copyAd: (id: string, text: string) => void
        readonly closeAd: () => void
    }
}

/** Draws the jobs tab: the job posts, what the owner can do with each, and the editor and ad dialogs. */
export const HiringJobsBase = (props: HiringJobsBaseProps) => {
    const { say, rows, isBusy, error, fact } = props.props
    const { on } = props
    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <Heading level={2}>{say("jobsTitle")}</Heading>
                <Button variant="primary" onPress={on.create}>
                    {say("jobsCreate")}
                </Button>
            </div>
            {error === null ? null : <Alert tone="negative" title={say("errorTitle")} description={error} />}
            <SurfaceListCard
                ariaLabel={say("jobsList")}
                fact={fact}
                empty={
                    <EmptyNotice
                        message={say("jobsEmptyTitle")}
                        description={say("jobsEmptyBody")}
                        actionLabel={say("jobsCreate")}
                        onAction={on.create}
                    />
                }
            >
                {rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        badges={
                            <Badge tone={row.statusTone} isDot>
                                {row.statusLabel}
                            </Badge>
                        }
                        description={row.facts}
                        actions={
                            <div className={ACTIONS_CLASS_NAME}>
                                {row.copyLabel === null ? null : (
                                    <Button variant="tertiary" size="sm" onPress={() => on.copy(row.id)}>
                                        {row.copyLabel}
                                    </Button>
                                )}
                                <Button variant="tertiary" size="sm" onPress={() => on.openPipeline(row.id)}>
                                    {say("jobsSeeCandidates")}
                                </Button>
                                <Button variant="secondary" size="sm" onPress={() => on.openAd(row.id)}>
                                    {say("jobsWriteAd")}
                                </Button>
                                <Button variant="secondary" size="sm" onPress={() => on.edit(row.id)}>
                                    {say("jobsEdit")}
                                </Button>
                                {row.transitions.map((transition) => (
                                    <Button
                                        key={transition.to}
                                        variant={transition.isPrimary ? "primary" : "ghost"}
                                        size="sm"
                                        isDisabled={isBusy}
                                        onPress={() => on.transition(row.id, transition.to)}
                                    >
                                        {transition.label}
                                    </Button>
                                ))}
                            </div>
                        }
                    >
                        <div className={FACTS_CLASS_NAME}>
                            <Text size="sm">{row.counts}</Text>
                            {row.publicUrl === null ? null : (
                                <Text size="xs" tone="muted">
                                    {row.publicUrl}
                                </Text>
                            )}
                        </div>
                    </ListRow>
                ))}
            </SurfaceListCard>
            {props.props.isEditorOpen ? (
                <HiringJobEditorDialog
                    props={props.props.editor}
                    on={{
                        text: on.editorText,
                        number: on.editorNumber,
                        list: on.editorList,
                        patchQuestion: on.patchQuestion,
                        addQuestion: on.addQuestion,
                        removeQuestion: on.removeQuestion,
                        save: on.saveEditor,
                        close: on.closeEditor,
                    }}
                />
            ) : null}
            {props.props.isAdOpen ? (
                <HiringJobAdDialog
                    props={props.props.ad}
                    on={{ generate: on.generateAd, copy: on.copyAd, close: on.closeAd }}
                />
            ) : null}
        </>
    )
}
