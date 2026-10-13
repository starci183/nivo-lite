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

/** The links of a post: a list of rows with add and remove. */
export const ContentEditorLinks = (props: ContentEditorLinksProps) => (
    <>
        <SectionHeader level={3} title={props.t("linksTitle")} />
        <div className={LINKS_CLASS_NAME}>
            {props.links.map((link) => (
                <div key={link.key} className={LINK_ROW_CLASS_NAME}>
                    <Input
                        id={`ce-link-${link.key}`}
                        name={`link-${link.key}`}
                        label={props.t("linkUrl")}
                        variant="secondary"
                        value={link.url}
                        isDisabled={!props.isEditable}
                        onValueChange={(v) => props.onChange(link.key, { url: v })}
                    />
                    <Input
                        id={`ce-linklabel-${link.key}`}
                        name={`linklabel-${link.key}`}
                        label={props.t("linkLabel")}
                        variant="secondary"
                        value={link.label}
                        isDisabled={!props.isEditable}
                        onValueChange={(v) => props.onChange(link.key, { label: v })}
                    />
                    {props.isEditable ? (
                        <Button variant="danger-soft" size="sm" onPress={() => props.onRemove(link.key)}>
                            {props.t("linkRemove")}
                        </Button>
                    ) : null}
                </div>
            ))}
            {props.isEditable ? (
                <div>
                    <Button variant="outline" size="sm" onPress={props.onAdd}>
                        {props.t("linkAdd")}
                    </Button>
                </div>
            ) : null}
        </div>
    </>
)
