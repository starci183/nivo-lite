import { DescriptionList, EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { STACK_CLASS_NAME } from "./classNames"

/** What the connected block settled for the figures strip. */
export interface HiringFiguresBaseProps {
    readonly props: {
        readonly state: "ready" | "loading" | "failed" | "forbidden"
        readonly ariaLabel: string
        readonly figures: ReadonlyArray<DescriptionListStatItem>
        readonly noticeTitle: string
        readonly noticeBody: string
    }
}

/** Draws the real Hiring figures (open roles, pipeline, interviews, offers), or the notice when the board cannot be read. */
export const HiringFiguresBase = (props: HiringFiguresBaseProps) => {
    const { state, ariaLabel, figures, noticeTitle, noticeBody } = props.props
    return (
        <div className={STACK_CLASS_NAME}>
            {state === "failed" || state === "forbidden" ? (
                <SurfaceCard ariaLabel={noticeTitle}>
                    <EmptyNotice message={noticeTitle} description={noticeBody} />
                </SurfaceCard>
            ) : (
                <SurfaceCard ariaLabel={ariaLabel}>
                    <DescriptionList layout="stat-strip" isDivided isLoading={state === "loading"} items={figures} />
                </SurfaceCard>
            )}
        </div>
    )
}
