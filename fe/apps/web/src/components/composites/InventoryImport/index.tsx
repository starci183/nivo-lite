import type { InventoryImportData, InventoryImportActions } from "@/modules/types"

/** Resolved import fields and atomic commands; the module Base owns read status. */
type InventoryImportProps = InventoryImportData & {
    readonly isLoading: boolean
    readonly onText: InventoryImportActions["onText"]
    readonly onPaste: InventoryImportActions["onPaste"]
    readonly onLoad: InventoryImportActions["onLoad"]
}
import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, EmptyNotice, SurfaceCard, Text, Textarea, Stack } from "@starci/grammar/common"

/** The import tab: paste a sheet, or start from a set for the kind of business. */
export const InventoryImport = (props: InventoryImportProps) => {
    const on = { text: props.onText, paste: props.onPaste, load: props.onLoad }
    if (!props.allowed) {
        return (
            <SurfaceCard isLoading={props.isLoading} ariaLabel={props.deniedTitle}>
                <EmptyNotice message={props.deniedTitle} description={props.deniedBody} />
            </SurfaceCard>
        )
    }
    return (
        <Stack gap="section">
            <SurfaceCard isLoading={props.isLoading} label={props.pasteTitle} headingLevel={2}>
                <Stack gap="row">
                    <Text size="sm" tone="muted">
                        {props.pasteHelp}
                    </Text>
                    <Textarea
                        isLoading={props.isLoading}
                        label={props.pasteLabel}
                        isLabelHidden
                        rows={8}
                        placeholder={props.pastePlaceholder}
                        value={props.text}
                        onValueChange={on.text}
                    />
                    <InventoryNotices error={props.error} notice={props.notice} />
                    <div>
                        <Button
                            isLoading={props.isLoading}
                            intent="commit"
                            isPending={props.isPending}
                            isDisabled={props.text.trim() === ""}
                            onPress={on.paste}
                        >
                            {props.pasteSubmit}
                        </Button>
                    </div>
                </Stack>
            </SurfaceCard>
            <SurfaceCard
                isLoading={props.isLoading}
                kind="list"
                empty={<EmptyNotice message={props.startFooter} />}
                items={props.templates.map((template) => ({
                    id: template.key,
                    title: template.name,
                    description: template.description,
                    action: { label: props.loadLabel, isDisabled: props.isPending, press: () => on.load(template.key) },
                }))}
                label={props.startTitle}
                headingLevel={2}
                footer={
                    <Text size="sm" tone="muted">
                        {props.startFooter}
                    </Text>
                }
            />
        </Stack>
    )
}
