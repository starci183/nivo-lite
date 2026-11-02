import type { HiringViews, HiringActions } from "@/modules/types"

type HiringWorkbenchSettingsProps = HiringViews["settingsFields"] & {
    readonly on: HiringActions["settingsActions"]
    readonly isLoading: boolean
}
import {
    Alert,
    Button,
    Input,
    NumberField,
    SurfaceCard,
    Switch,
    Textarea,
    Stack,
    Cluster,
} from "@starci/grammar/common"

/** Draws the settings tab: the public link, how long closed files are kept, what the agent does by itself and the consent text. */
export const HiringWorkbenchSettings = (props: HiringWorkbenchSettingsProps) => {
    const { copy, slugHint, values, retentionMin, retentionMax, isBusy, error, notice } = props
    const { on } = props
    return (
        <>
            <SurfaceCard isLoading={props.isLoading} label={copy.setCardTitle} headingLevel={2}>
                <Stack gap="row">
                    <Input
                        isLoading={props.isLoading}
                        id="st-slug"
                        name="slug"
                        label={copy.setSlug}
                        value={values.publicSlug}
                        onValueChange={(slug) => on.text("publicSlug", slug)}
                        description={slugHint}
                    />
                    <NumberField
                        isLoading={props.isLoading}
                        label={copy.setRetention}
                        description={copy.setRetentionHint}
                        minValue={retentionMin}
                        maxValue={retentionMax}
                        step={1}
                        value={values.retentionDays}
                        onValueChange={(days) => on.number("retentionDays", Number.isFinite(days) ? days : 90)}
                    />
                    <Textarea
                        isLoading={props.isLoading}
                        label={copy.setConsent}
                        rows={3}
                        maxLength={800}
                        value={values.applyConsentText}
                        onValueChange={(text) => on.text("applyConsentText", text)}
                    />
                    <Input
                        isLoading={props.isLoading}
                        id="st-tone"
                        name="tone"
                        label={copy.setTone}
                        value={values.adTone}
                        onValueChange={(tone) => on.text("adTone", tone)}
                    />
                    <SettingsAutomation copy={copy} values={values} onFlag={on.flag} isLoading={props.isLoading} />
                    {error === null ? null : <Alert tone="negative" title={copy.errorNotSaved} description={error} />}
                    {notice === null ? null : <Alert tone="affirmative" title={notice} />}
                    <Cluster gap="inline">
                        <Button
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={isBusy}
                            isDisabled={isBusy}
                            onPress={on.save}
                        >
                            {copy.setSave}
                        </Button>
                    </Cluster>
                </Stack>
            </SurfaceCard>
        </>
    )
}

interface SettingsAutomationProps {
    readonly copy: Pick<
        HiringWorkbenchSettingsProps["copy"],
        "setNotify" | "setNotifyHint" | "setRemind" | "setRemindHint" | "setAutoClose" | "setAutoCloseHint"
    >
    readonly values: Pick<
        HiringWorkbenchSettingsProps["values"],
        "notifyNewCandidate" | "remindInterview" | "autoCloseWhenFilled"
    >
    readonly onFlag: HiringWorkbenchSettingsProps["on"]["flag"]
    readonly isLoading: boolean
}

/** The three existing notification/closing policies remain a coherent settings field group. */
const SettingsAutomation = (props: SettingsAutomationProps) => {
    const { copy, values } = props
    return (
        <>
            {" "}
            <Switch
                isLoading={props.isLoading}
                label={copy.setNotify}
                description={copy.setNotifyHint}
                isSelected={values.notifyNewCandidate}
                onSelectedChange={(isOn) => props.onFlag("notifyNewCandidate", isOn)}
            />
            <Switch
                isLoading={props.isLoading}
                label={copy.setRemind}
                description={copy.setRemindHint}
                isSelected={values.remindInterview}
                onSelectedChange={(isOn) => props.onFlag("remindInterview", isOn)}
            />
            <Switch
                isLoading={props.isLoading}
                label={copy.setAutoClose}
                description={copy.setAutoCloseHint}
                isSelected={values.autoCloseWhenFilled}
                onSelectedChange={(isOn) => props.onFlag("autoCloseWhenFilled", isOn)}
            />
        </>
    )
}
