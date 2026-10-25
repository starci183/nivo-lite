import { InventoryNotices } from "@/components/leaves/InventoryNotices"
import { Button, EmptyNotice, ListRow, SurfaceCard, SurfaceListCard, Text, Textarea } from "@starci/grammar/common"
import { FORM_CLASS_NAME, STACK_CLASS_NAME } from "./classNames"

/** One starter set to load. */
export interface TemplateRowView {
    readonly key: string
    readonly name: string
    readonly description: string
}

/** The words and data of the import tab. */
export interface InventoryImportBaseProps {
    readonly props: {
        /** False when the person may only count and adjust: the tab then says so. */
        readonly allowed: boolean
        readonly deniedTitle: string
        readonly deniedBody: string
        readonly pasteTitle: string
        readonly pasteHelp: string
        readonly pasteLabel: string
        readonly pastePlaceholder: string
        readonly pasteSubmit: string
        readonly text: string
        readonly startTitle: string
        readonly startFooter: string
        readonly loadLabel: string
        readonly templates: ReadonlyArray<TemplateRowView>
        readonly isPending: boolean
        readonly error: string | null
        readonly notice: string | null
    }
    readonly on: {
        readonly text: (value: string) => void
        readonly paste: () => void
        readonly load: (key: string) => void
    }
}

/** The import tab: paste a sheet, or start from a set for the kind of business. */
export const InventoryImportBase = (props: InventoryImportBaseProps) => {
    const { props: p, on } = props
    if (!p.allowed) {
        return (
            <SurfaceCard ariaLabel={p.deniedTitle}>
                <EmptyNotice message={p.deniedTitle} description={p.deniedBody} />
            </SurfaceCard>
        )
    }
    return (
        <div className={STACK_CLASS_NAME}>
            <SurfaceCard label={p.pasteTitle} headingLevel={2}>
                <div className={FORM_CLASS_NAME}>
                    <Text size="sm" tone="muted">
                        {p.pasteHelp}
                    </Text>
                    <Textarea
                        label={p.pasteLabel}
                        isLabelHidden
                        rows={8}
                        placeholder={p.pastePlaceholder}
                        value={p.text}
                        onValueChange={on.text}
                    />
                    <InventoryNotices error={p.error} notice={p.notice} />
                    <div>
                        <Button
                            intent="commit"
                            isPending={p.isPending}
                            isDisabled={p.text.trim() === ""}
                            onPress={on.paste}
                        >
                            {p.pasteSubmit}
                        </Button>
                    </div>
                </div>
            </SurfaceCard>
            <SurfaceListCard
                label={p.startTitle}
                headingLevel={2}
                footer={
                    <Text size="sm" tone="muted">
                        {p.startFooter}
                    </Text>
                }
            >
                {p.templates.map((template) => (
                    <ListRow
                        key={template.key}
                        title={template.name}
                        description={template.description}
                        actions={
                            <Button
                                intent="neutral"
                                size="sm"
                                isDisabled={p.isPending}
                                onPress={() => on.load(template.key)}
                            >
                                {p.loadLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
        </div>
    )
}
