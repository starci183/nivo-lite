import { Button, Input, SectionHeader } from "@starci/grammar/common"
import type { ContentT } from "@/hooks/content"
import { LINKS_CLASS_NAME, LINK_ROW_CLASS_NAME } from "./classNames"

/** One link row of the editor. */
export interface LinkRow {
    /** A stable key of the row. */
    readonly key: string
    readonly url: string
    readonly label: string
}

/** Props of {@link ContentEditorLinks}. */
interface ContentEditorLinksProps {
    readonly links: ReadonlyArray<LinkRow>
    readonly isEditable: boolean
    readonly t: ContentT
    readonly onChange: (key: string, change: { readonly url?: string; readonly label?: string }) => void
    readonly onAdd: () => void
    readonly onRemove: (key: string) => void
}

interface LinkField {
    readonly key: "url" | "label"
    readonly name: "link" | "linklabel"
    readonly labelKey: "linkUrl" | "linkLabel"
}

const LINK_FIELDS: ReadonlyArray<LinkField> = [
    { key: "url", name: "link", labelKey: "linkUrl" },
    { key: "label", name: "linklabel", labelKey: "linkLabel" },
]

/** The links of a post: a list of rows with add and remove. */
export const ContentEditorLinks = (props: ContentEditorLinksProps) => (
    <>
        <SectionHeader level={3} title={props.t("linksTitle")} />
        <div className={LINKS_CLASS_NAME}>
            {props.links.map((link) => (
                <div key={link.key} className={LINK_ROW_CLASS_NAME}>
                    {LINK_FIELDS.map((field) => (
                        <Input
                            key={field.key}
                            id={`ce-${field.name}-${link.key}`}
                            name={`${field.name}-${link.key}`}
                            label={props.t(field.labelKey)}
                            value={link[field.key]}
                            isDisabled={!props.isEditable}
                            onValueChange={(v) => props.onChange(link.key, { [field.key]: v })}
                        />
                    ))}
                    {props.isEditable ? (
                        <Button intent="destructive" step="entry" size="sm" onPress={() => props.onRemove(link.key)}>
                            {props.t("linkRemove")}
                        </Button>
                    ) : null}
                </div>
            ))}
            {props.isEditable ? (
                <div>
                    <Button intent="neutral" size="sm" onPress={props.onAdd}>
                        {props.t("linkAdd")}
                    </Button>
                </div>
            ) : null}
        </div>
    </>
)
