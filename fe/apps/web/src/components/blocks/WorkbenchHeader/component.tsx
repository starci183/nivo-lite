import type { DescriptionListStatItem } from "@starci/grammar/common"
import { WorkbenchFrameHead } from "@/components/leaves/WorkbenchFrameHead"
import { WorkbenchRegions } from "@/components/leaves/WorkbenchRegions"
import { WorkbenchTabsNav } from "@/components/leaves/WorkbenchTabsNav"
import type { AgentDashboardView, ModuleKey } from "@/hooks/agent-dashboard"
import { HEADER_CLASS_NAME } from "./classNames"

/** The words of the head and of the tab strip. */
interface WorkbenchHeaderLabels {
    readonly commandChat: string
    readonly modeAutopilot: string
    readonly modeAssist: string
    readonly regionFailed: string
    readonly regionFailedText: string
    readonly retry: string
    readonly ribbonAria: string
    readonly tabsLabel: string
}

/** The translator and the timestamp format of the common regions. */
interface WorkbenchRegionsWords {
    readonly t: (key: string, values?: Record<string, string | number>) => string
    readonly when: (iso: string | null | undefined) => string
}

/** One tab of the strip. */
interface WorkbenchHeaderTab {
    readonly id: string
    readonly label: string
}

/** What the header of a workbench draws, and what it reports back. */
export interface WorkbenchHeaderBaseProps {
    readonly props: {
        readonly module: ModuleKey
        readonly title: string
        readonly data: AgentDashboardView | undefined
        readonly isLoading: boolean
        readonly labels: WorkbenchHeaderLabels
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly figuresFailed: boolean
        readonly tabs: ReadonlyArray<WorkbenchHeaderTab>
        readonly selectedTab: string
    }
    readonly on: {
        readonly retry: () => void
        readonly select: (id: string) => void
        /** The translator and the timestamp format of the common regions. */
        readonly words: WorkbenchRegionsWords
    }
}

/** The header of a workbench: the agent head with its figures, the four common regions and the tab strip. */
export const WorkbenchHeaderBase = (props: WorkbenchHeaderBaseProps) => {
    const { props: p, on } = props
    return (
        <div className={HEADER_CLASS_NAME}>
            <WorkbenchFrameHead
                title={p.title}
                isLoading={p.isLoading}
                agent={p.data?.agent ?? null}
                labels={p.labels}
                figures={p.figures}
                figuresFailed={p.figuresFailed}
                retry={on.retry}
            />
            <WorkbenchRegions
                module={p.module}
                data={p.data}
                isLoading={p.isLoading}
                retry={on.retry}
                view={on.words}
            />
            {p.tabs.length > 1 ? (
                <WorkbenchTabsNav
                    label={p.labels.tabsLabel}
                    items={p.tabs}
                    selected={p.selectedTab}
                    onSelect={on.select}
                />
            ) : null}
        </div>
    )
}
