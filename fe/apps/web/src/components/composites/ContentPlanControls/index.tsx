import type { ContentViews, ContentActions } from "@/modules/types"

type ContentPlanControlsProps = ContentViews["planFields"] & {
    readonly on: ContentActions["planActions"]
    readonly isLoading: boolean
}
import { Button, Dialog, Select, Stack, Text } from "@starci/grammar/common"
import { ContentCommandNote } from "@/components/leaves/ContentCommandNote"

/** The footer of the plan dialog: close it, or run the plan. */
const PlanFooter = (props: ContentPlanControlsProps) => (
    <>
        <Button isLoading={props.isLoading} intent="dismiss" isDisabled={props.isPending} onPress={props.on.close}>
            {props.copy.close}
        </Button>
        <Button isLoading={props.isLoading} intent="commit" isPending={props.isPending} onPress={props.on.run}>
            {props.copy.planRun}
        </Button>
    </>
)

/** Draws the primary command of the workbench, "Plan the month", and its dialog: pick the month, wait for OpenClaw, read how long it took. */
export const ContentPlanControls = (props: ContentPlanControlsProps) => {
    const { copy, isPending } = props
    return (
        <>
            <Button isLoading={props.isLoading} intent="commit" onPress={props.on.open}>
                {copy.planMonth}
            </Button>
            <Dialog
                isOpen={props.isOpen}
                onOpenChange={props.on.openChange}
                size="md"
                title={copy.planTitle}
                description={copy.planBody}
                closeLabel={props.copy.close}
                isDismissable={!isPending}
                footer={<PlanFooter {...props} />}
            >
                <Stack gap="row">
                    <Select
                        isLoading={props.isLoading}
                        label={copy.planMonthLabel}
                        options={props.months}
                        value={props.month}
                        isDisabled={isPending}
                        onValueChange={(id) => {
                            if (id) props.on.month(id)
                        }}
                    />
                    {isPending ? (
                        <Text size="sm" live="polite">
                            {copy.planRunning}
                        </Text>
                    ) : null}
                    {props.lastPlan ? (
                        <Text size="xs" tone="muted">
                            {props.lastPlan}
                        </Text>
                    ) : null}
                    <ContentCommandNote
                        note={props.note}
                        closeLabel={props.copy.close}
                        onDismiss={props.on.dismissNote}
                    />
                </Stack>
            </Dialog>
        </>
    )
}
