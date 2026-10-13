import { Alert, Button, Dialog, Select, Text } from "@starci/grammar/common"
import type { ContentNote, ContentT } from "@/hooks/content"
import { FORM_CLASS_NAME } from "./classNames"

/** What the plan command draws. */
export interface ContentPlanActionBaseProps {
    readonly props: {
        readonly t: ContentT
        readonly isOpen: boolean
        readonly months: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly month: string
        readonly lastPlan: string | null
        readonly isPending: boolean
        readonly note: ContentNote | null
    }
    readonly on: {
        readonly open: () => void
        readonly close: () => void
        readonly month: (id: string) => void
        readonly run: () => void
        readonly dismissNote: () => void
    }
}

/** Draws the primary command of the workbench, "Plan the month", and its dialog: pick the month, wait for OpenClaw, read how long it took. */
export const ContentPlanActionBase = (props: ContentPlanActionBaseProps) => {
    const { t, isPending } = props.props
    return (
        <>
            <Button variant="primary" onPress={props.on.open}>
                {t("planMonth")}
            </Button>
            <Dialog
                isOpen={props.props.isOpen}
                onOpenChange={(open) => {
                    if (!open && !isPending) props.on.close()
                }}
                size="md"
                title={t("planTitle")}
                description={t("planBody")}
                closeLabel={t("close")}
                isDismissable={!isPending}
                footer={
                    <>
                        <Button variant="outline" isDisabled={isPending} onPress={props.on.close}>
                            {t("close")}
                        </Button>
                        <Button variant="primary" isPending={isPending} onPress={props.on.run}>
                            {t("planRun")}
                        </Button>
                    </>
                }
            >
                <div className={FORM_CLASS_NAME}>
                    <Select
                        variant="secondary"
                        label={t("planMonthLabel")}
                        options={props.props.months}
                        value={props.props.month}
                        isDisabled={isPending}
                        onValueChange={(id) => {
                            if (id) props.on.month(id)
                        }}
                    />
                    {isPending ? (
                        <Text size="sm" live="polite">
                            {t("planRunning")}
                        </Text>
                    ) : null}
                    {props.props.lastPlan ? (
                        <Text size="xs" tone="muted">
                            {props.props.lastPlan}
                        </Text>
                    ) : null}
                    {props.props.note ? (
                        <Alert
                            title={props.props.note.text}
                            tone={props.props.note.tone === "ok" ? "affirmative" : "negative"}
                            dismissLabel={t("close")}
                            onDismiss={props.on.dismissNote}
                        />
                    ) : null}
                </div>
            </Dialog>
        </>
    )
}
