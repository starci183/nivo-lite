import { Badge, Cluster, SurfaceCard } from "@starci/grammar/common"

interface FigureCaption {
    readonly id: string
    readonly term: string
    readonly unit?: string
    readonly meta?: string
}
interface FigureValue {
    readonly id: string
    readonly value: string
    readonly meta: string
}
interface FigureAlert {
    readonly id: string
    readonly term: string
}
interface ShiftsFigureStripProps {
    readonly ariaLabel: string
    readonly captions: ReadonlyArray<FigureCaption>
    readonly stats: ReadonlyArray<FigureValue>
    readonly alerts?: ReadonlyArray<FigureAlert>
    readonly isLoading?: boolean
}

/** Draws resolved shift figures in caption order and, when present, their alert badges. */
export const ShiftsFigureStrip = (props: ShiftsFigureStripProps) => (
    <SurfaceCard
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
        kind="figures"
        ariaLabel={props.ariaLabel}
        items={props.captions.map((caption) => {
            const stat = props.stats.find((item) => item.id === caption.id)
            return {
                id: caption.id,
                term: caption.term,
                value: stat?.value ?? "",
                ...(caption.unit === undefined ? {} : { unit: caption.unit }),
                meta: stat?.meta ?? caption.meta ?? "",
            }
        })}
        {...(props.alerts === undefined
            ? {}
            : {
                  footer: (
                      <Cluster gap="inline">
                          {props.alerts.map((stat) => (
                              <Badge
                                  {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
                                  key={stat.id}
                                  tone="danger"
                                  isDot
                              >
                                  {stat.term}
                              </Badge>
                          ))}
                      </Cluster>
                  ),
              })}
    />
)
