import { EmptyNotice, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { ContactFactView, ContactsPanesCopy } from "@/modules/types"

/** What the memory card draws and does. */
interface ContactMemoryCardProps {
    readonly copy: Pick<ContactsPanesCopy, "memoryTitle" | "memoryEmpty" | "forgetLabel" | "rowMenuLabel">
    readonly facts: ReadonlyArray<ContactFactView>
    readonly isLoading: boolean
    readonly onForget: (name: string) => void
}

/** One fact the agents remember: its name, its value at the end, and the command that makes them forget it. */
const factRowOf = (fact: ContactFactView, props: ContactMemoryCardProps): ListRowData => ({
    id: fact.name,
    title: fact.name,
    value: fact.value,
    menu: {
        label: props.copy.rowMenuLabel,
        entries: [
            {
                kind: "section",
                id: "fact",
                items: [
                    {
                        id: "forget",
                        label: props.copy.forgetLabel,
                        tone: "danger" as const,
                        onAction: () => props.onForget(fact.name),
                    },
                ],
            },
        ],
    },
})

/** What the agents remember about the person: the facts as key and value rows, each with "forget"; the standard empty notice when none. */
export const ContactMemoryCard = (props: ContactMemoryCardProps) => (
    <SurfaceCard
        kind="list"
        layout="keyValue"
        label={props.copy.memoryTitle}
        headingLevel={2}
        count={props.facts.length}
        isLoading={props.isLoading}
        items={props.facts.map((fact) => factRowOf(fact, props))}
        empty={<EmptyNotice message={props.copy.memoryEmpty} iconSource={nivoIconSource("brain", "leading")} />}
    />
)
