import { Button, Drawer, EmptyNotice, SearchField, Stack, SurfaceCard } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ContactMergeView, ContactsPanesCopy } from "@/modules/types"

/** What the merge drawer draws and does. */
interface ContactMergeDrawerProps {
    readonly view: ContactMergeView
    readonly copy: ContactsPanesCopy["merge"]
    readonly cancelLabel: string
    readonly closeLabel: string
    readonly on: {
        readonly close: () => void
        readonly setQuery: (value: string) => void
        readonly choose: (id: string) => void
        readonly submit: () => void
    }
}

/** The drawer that picks the person to merge into the open one: a search over the people, and one choice among those found. */
export const ContactMergeDrawer = (props: ContactMergeDrawerProps) => (
    <Drawer
        isOpen={props.view.isOpen}
        onOpenChange={(isOpen) => {
            if (!isOpen) props.on.close()
        }}
        title={props.copy.title}
        description={props.view.hint}
        closeLabel={props.closeLabel}
        isLoading={props.view.isLoading}
        footer={
            <>
                <Button intent="dismiss" onPress={props.on.close}>
                    {props.cancelLabel}
                </Button>
                <Button intent="commit" isDisabled={props.view.chosenId === null} onPress={props.on.submit}>
                    {props.copy.submitLabel}
                </Button>
            </>
        }
    >
        <Stack gap="section">
            <SearchField
                label={props.copy.searchLabel}
                isLabelHidden
                placeholder={props.copy.searchPlaceholder}
                clearLabel={props.copy.clearSearch}
                value={props.view.query}
                onValueChange={props.on.setQuery}
                onClear={() => props.on.setQuery("")}
            />
            {props.view.choices.length === 0 ? (
                <EmptyNotice message={props.copy.emptyTitle} iconSource={nivoIconSource("search", "leading")} />
            ) : (
                <SurfaceCard
                    kind="select"
                    ariaLabel={props.copy.title}
                    selectionMode="single"
                    value={props.view.chosenId}
                    onChange={props.on.choose}
                    items={props.view.choices.map((choice) => ({
                        id: choice.id,
                        title: choice.title,
                        ...(choice.subtitle === "" ? {} : { subtitle: choice.subtitle }),
                    }))}
                />
            )}
        </Stack>
    </Drawer>
)
