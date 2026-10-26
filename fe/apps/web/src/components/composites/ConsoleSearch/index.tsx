import { Dialog, IconButton, PressableField, SearchField } from "@starci/grammar/common"
import { nivoIconSource } from "../../leaves/Icon"
import { FIELD, ICON } from "./classNames"

/** What the customer search draws and reports. */
type ConsoleSearchProps = {
    /** `field` is the compact search trigger of the bar's middle; `icon` is the icon button that stands in on a phone and holds the dialog. */
    readonly part: "field" | "icon"
    readonly label: string
    readonly placeholder: string
    readonly shortcut: string
    readonly closeLabel: string
    readonly query: string
    readonly isOpen: boolean
    readonly onOpenChange: (isOpen: boolean) => void
    readonly onQueryChange: (query: string) => void
    readonly onSubmit: (query: string) => void
}

/** The search trigger with its keyboard hint; pressing it (or Ctrl+K) opens a dialog holding the customer search. */
export const ConsoleSearch = (props: ConsoleSearchProps) =>
    props.part === "field" ? (
        <div className={FIELD}>
            <PressableField
                label={props.label}
                placeholder={props.placeholder}
                shortcut={props.shortcut}
                source={nivoIconSource("search", "leading")}
                onPress={() => props.onOpenChange(true)}
            />
        </div>
    ) : (
        <>
            <div className={ICON}>
                <IconButton
                    intent="neutral"
                    source={nivoIconSource("search", "leading")}
                    label={props.label}
                    onPress={() => props.onOpenChange(true)}
                />
            </div>
            <Dialog
                isOpen={props.isOpen}
                onOpenChange={props.onOpenChange}
                title={props.label}
                closeLabel={props.closeLabel}
                size="sm"
            >
                <SearchField
                    label={props.label}
                    isLabelHidden
                    autoFocus
                    placeholder={props.placeholder}
                    value={props.query}
                    onValueChange={props.onQueryChange}
                    onClear={() => props.onQueryChange("")}
                    onSubmit={(value) => {
                        const text = value.trim()
                        if (text.length > 0) props.onSubmit(text)
                    }}
                />
            </Dialog>
        </>
    )
