import { Disclosure, EmptyNotice, SurfaceCard } from "@starci/grammar/common"

/** One automation the owner hid. */
type AutomationHiddenItem = {
    readonly key: string
    readonly name: string
    readonly isBusy: boolean
}

/** What the list of hidden automations shows. */
type AutomationHiddenListProps = {
    readonly title: string
    readonly restoreLabel: string
    readonly items: ReadonlyArray<AutomationHiddenItem>
    readonly onRestore: (key: string) => void
}

/** The automations the owner marked "not for me", each with its restore action; nothing when none is hidden. */
export const AutomationHiddenList = (props: AutomationHiddenListProps) =>
    props.items.length === 0 ? null : (
        <Disclosure
            title={props.title}
            body={
                <SurfaceCard
                    kind="list"
                    ariaLabel={props.title}
                    items={props.items.map((item) => ({
                        id: item.key,
                        title: item.name,
                        action: {
                            label: props.restoreLabel,
                            intent: "neutral",
                            isDisabled: item.isBusy,
                            press: () => props.onRestore(item.key),
                        },
                    }))}
                    empty={<EmptyNotice message={props.title} />}
                />
            }
        />
    )
