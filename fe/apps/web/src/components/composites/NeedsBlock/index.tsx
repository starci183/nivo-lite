import { Badge, Button, IconTile, SurfaceCard, Text } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import type { WorkbenchNeedView } from "@/modules/types"
import { NEED_CLASS_NAME, NEED_COPY_CLASS_NAME, NEEDS_CLASS_NAME } from "./classNames"

/** The needs of a desk that no connection meets yet. */
export interface NeedsBlockProps {
    readonly needs: ReadonlyArray<WorkbenchNeedView>
}

/**
 * A block that cannot be drawn until something is connected says so: what it needs, what connecting gives, and one place to
 * connect it. Nothing is drawn for a need that is met (workbench section 9).
 */
export const NeedsBlock = (props: NeedsBlockProps) =>
    props.needs.length === 0 ? null : (
        <div className={NEEDS_CLASS_NAME}>
            {props.needs.map((need) => (
                <SurfaceCard key={need.id} ariaLabel={need.title}>
                    <div className={NEED_CLASS_NAME}>
                        <IconTile source={nivoIconSource("warning", "leading")} tone="warning" />
                        <div className={NEED_COPY_CLASS_NAME}>
                            <Text size="md" weight="semibold">
                                {need.title}
                            </Text>
                            <Text size="sm" tone="muted">
                                {need.body}
                            </Text>
                        </div>
                        <Badge tone="warning">{need.badge}</Badge>
                        <Button intent="neutral" href={need.href}>
                            {need.actionLabel}
                        </Button>
                    </div>
                </SurfaceCard>
            ))}
        </div>
    )
