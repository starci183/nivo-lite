import { PaneSection, Tabs } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** The words of the thread around its messages. */
interface TeamChatThreadCopy {
    readonly threadLabel: string
    readonly tabAll: string
    readonly tabPinned: string
    readonly tabsLabel: string
}

/** What the thread of the open room draws around its messages. */
interface TeamChatThreadProps {
    readonly copy: TeamChatThreadCopy
    readonly isWaiting: boolean
    readonly tab: "all" | "pinned"
    readonly onTab: (tab: "all" | "pinned") => void
    /** The messages of the room, drawn through the slot recipe by the owner. */
    readonly children: ReactNode
}

/** The tabs of all and pinned messages over the scrolling thread of the open room. */
export const TeamChatThread = (props: TeamChatThreadProps) => (
    <>
        <PaneSection bleed="inline">
            <Tabs
                label={props.copy.tabsLabel}
                selectedKey={props.tab}
                items={[
                    { id: "all", label: props.copy.tabAll },
                    { id: "pinned", label: props.copy.tabPinned },
                ]}
                onSelect={(key) => props.onTab(key === "pinned" ? "pinned" : "all")}
                kind="filter"
                inset="none"
                labelVisibility="always"
            />
        </PaneSection>
        <PaneSection
            scroll={{ label: props.copy.threadLabel, role: "log", tone: "background", align: "end" }}
            isLoading={props.isWaiting}
        >
            {props.children}
        </PaneSection>
    </>
)
