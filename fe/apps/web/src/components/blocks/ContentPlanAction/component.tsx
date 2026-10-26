import { Button, Dialog, Select, Text } from "@starci/grammar/common"
import {
    ContentCommandNote,
    getContentCommandProgressProps,
    renderContentCommandProgress,
} from "@/components/composites/ContentSettingsCard"
import { SlotView } from "@/components/composites/SlotView"
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
        readonly openChange: (open: boolean) => void
        readonly month: (id: string) => void
        readonly run: () => void
        readonly dismissNote: () => void
    }
}

/** The footer of the plan dialog: close it, or run the plan. */
const PlanFooter = (props: ContentPlanActionBaseProps) => (
    <>
        <Button intent="dismiss" isDisabled={props.props.isPending} onPress={props.on.close}>
            {props.props.t("close")}
        </Button>
        <Button intent="commit" isPending={props.props.isPending} onPress={props.on.run}>
            {props.props.t("planRun")}
        </Button>
    </>
)

/** Draws the primary command of the workbench, "Plan the month", and its dialog: pick the month, wait for OpenClaw, read how long it took. */
export const ContentPlanActionBase = (props: ContentPlanActionBaseProps) => {
    const { t, isPending } = props.props
    return (
        <>
            <Button intent="commit" onPress={props.on.open}>
                {t("planMonth")}
            </Button>
            <Dialog
                isOpen={props.props.isOpen}
                onOpenChange={props.on.openChange}
                size="md"
                title={t("planTitle")}
                description={t("planBody")}
                closeLabel={t("close")}
                isDismissable={!isPending}
                footer={<PlanFooter {...props} />}
            >
                <div className={FORM_CLASS_NAME}>
                    <Select
                        label={t("planMonthLabel")}
                        options={props.props.months}
                        value={props.props.month}
                        isDisabled={isPending}
                        onValueChange={(id) => {
                            if (id) props.on.month(id)
                        }}
                    />
                    <SlotView {...getContentCommandProgressProps(isPending, t("planRunning"))}>
                        {renderContentCommandProgress}
                    </SlotView>
                    {props.props.lastPlan ? (
                        <Text size="xs" tone="muted">
                            {props.props.lastPlan}
                        </Text>
                    ) : null}
                    <ContentCommandNote
                        note={props.props.note}
                        closeLabel={t("close")}
                        onDismiss={props.on.dismissNote}
                    />
                </div>
            </Dialog>
        </>
    )
}
