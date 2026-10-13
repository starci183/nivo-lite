import {
    Alert,
    Badge,
    Button,
    DescriptionList,
    SectionHeader,
    SurfaceCard,
    type DescriptionListStatItem,
} from "@starci/grammar/common"
import { agentChatHref } from "@/modules/routes"
import { HEAD_CLASS_NAME } from "./classNames"

/** The agent a workbench belongs to. */
interface WorkbenchAgent {
    readonly id: string
    readonly name: string
    readonly mode: "autopilot" | "assist"
}

/** The words of the head. */
interface WorkbenchFrameHeadLabels {
    readonly commandChat: string
    readonly modeAutopilot: string
    readonly modeAssist: string
    readonly regionFailed: string
    readonly regionFailedText: string
    readonly retry: string
    readonly ribbonAria: string
}

/** What the head of a workbench draws. */
interface WorkbenchFrameHeadProps {
    readonly title: string
    readonly isLoading: boolean
    readonly agent: WorkbenchAgent | null
    readonly labels: WorkbenchFrameHeadLabels
    readonly figures: ReadonlyArray<DescriptionListStatItem>
    readonly figuresFailed: boolean
    readonly retry: () => void
}

/** The agent heading with its mode badge and chat button, and the ribbon of figures (or its failure with a retry). */
export const WorkbenchFrameHead = (props: WorkbenchFrameHeadProps) => {
    const { title, isLoading, agent, labels, figures, figuresFailed, retry } = props
    return (
        <>
            <div className={HEAD_CLASS_NAME}>
                <SectionHeader
                    level={2}
                    title={title}
                    isSkeleton={isLoading}
                    meta={
                        agent ? (
                            <Badge tone={agent.mode === "autopilot" ? "success" : "accent"} isDot>
                                {agent.mode === "autopilot" ? labels.modeAutopilot : labels.modeAssist}
                            </Badge>
                        ) : undefined
                    }
                    action={
                        agent ? (
                            <Button variant="primary" href={agentChatHref(agent.id)}>
                                {labels.commandChat}
                            </Button>
                        ) : undefined
                    }
                />
            </div>
            {figuresFailed ? (
                <Alert
                    tone="negative"
                    title={labels.regionFailed}
                    description={labels.regionFailedText}
                    action={{ label: labels.retry, onAction: retry }}
                />
            ) : (
                <SurfaceCard ariaLabel={labels.ribbonAria}>
                    <DescriptionList layout="stat-strip" isDivided isLoading={isLoading} items={figures} />
                </SurfaceCard>
            )}
        </>
    )
}
