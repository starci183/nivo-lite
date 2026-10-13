"use client"

import { useWorkbenchHeader } from "@/hooks/agent-dashboard"
import { useContentHeaderParts } from "@/hooks/content"
import { useVideoHeaderParts } from "@/hooks/video"
import { WorkbenchHeaderBase } from "./component"

/** The header part of each module, chosen by the module the page opened. */
const HEADER_PARTS = {
    content: useContentHeaderParts,
    video: useVideoHeaderParts,
}

/** What the page tells the header. */
interface WorkbenchHeaderProps {
    /** The module whose workbench this is. */
    readonly module: "content" | "video"
    /** The agent instance the workbench opened for. */
    readonly installationId?: string | null
    /** The tab named in the address. */
    readonly tab: string
}

/** The header of a workbench: the agent head, the ribbon, the common regions and the tab strip. */
export const WorkbenchHeader = (props: WorkbenchHeaderProps) => {
    const header = useWorkbenchHeader(props.module, props.installationId, props.tab)
    const parts = HEADER_PARTS[props.module]()
    const isLoading = header.isLoading || parts.isLoading
    const agent = header.data?.agent ?? null
    return (
        <WorkbenchHeaderBase
            props={{
                module: props.module,
                title: isLoading ? header.moduleName : agent?.name || header.moduleName,
                data: header.data,
                isLoading,
                labels: header.labels,
                figures: parts.figures,
                figuresFailed: parts.figuresFailed,
                tabs: parts.tabs,
                selectedTab: props.tab,
            }}
            on={{ retry: header.retry, select: header.select, words: { t: header.t, when: header.when } }}
        />
    )
}
