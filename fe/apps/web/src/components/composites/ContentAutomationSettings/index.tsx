import type { ContentViews, ContentActions } from "@/modules/types"

type ContentAutomationSettingsProps = ContentViews["automationFields"] & {
    readonly on: ContentActions["automationActions"]
    readonly isLoading: boolean
}
import { Alert, Stack, SurfaceCard, Switch, Text } from "@starci/grammar/common"

/** Draws the three automations as switches. They run in the back end; they only write Office messages and drafts, never post. */
export const ContentAutomationSettings = (props: ContentAutomationSettingsProps) => {
    const { copy } = props
    return (
        <SurfaceCard isLoading={props.isLoading} label={copy.settingsAuto} headingLevel={2}>
            <Stack gap="row">
                <Text size="sm" tone="muted">
                    {copy.settingsAutoBody}
                </Text>
                {props.rows.map((row) => (
                    <Switch
                        isLoading={props.isLoading}
                        key={row.key}
                        label={row.title}
                        description={row.body}
                        isSelected={row.on}
                        isDisabled={!props.canManage || props.isPending}
                        onSelectedChange={(v) => props.on.toggle(row.key, v)}
                    />
                ))}
                {props.note ? (
                    <Alert
                        title={props.note.text}
                        tone={props.note.tone === "ok" ? "affirmative" : "negative"}
                        dismissLabel={copy.close}
                        onDismiss={props.on.dismissNote}
                    />
                ) : null}
            </Stack>
        </SurfaceCard>
    )
}
