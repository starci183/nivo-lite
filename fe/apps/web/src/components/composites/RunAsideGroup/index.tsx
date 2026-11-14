import { Badge, Cluster, Link, Stack, Sublabel, SurfaceCard, Text, Tooltip, type ListRowData } from "@starci/grammar/common"
import type { RunParamView } from "@/modules/types"

/** What the group of the aside of a step draws: its label, how many it holds, its rows and the line for none. */
interface RunAsideGroupProps {
    readonly label: string
    /** The count chip beside the label; none draws no chip. */
    readonly count?: number
    /** Rows as title with a supporting line (the default), or as a key and its value. */
    readonly layout?: "rows" | "keyValue"
    readonly rows: ReadonlyArray<ListRowData>
    readonly empty: string
}

/** One group of the aside of a step: its small label above (with a count chip when it counts), then its one bordered list card. */
export const RunAsideGroup = (props: RunAsideGroupProps) => (
    <Stack gap="inline">
        <Cluster gap="identity">
            <Sublabel>{props.label}</Sublabel>
            {props.count === undefined ? null : <Badge tone="muted">{String(props.count)}</Badge>}
        </Cluster>
        <SurfaceCard
            kind="list"
            ariaLabel={props.label}
            layout={props.layout ?? "rows"}
            items={props.rows}
            empty={<Text tone="muted">{props.empty}</Text>}
        />
    </Stack>
)

/** What the value of a param draws. */
interface RunParamValueProps {
    readonly param: RunParamView
    readonly masked: string
    readonly missing: string
}

/** The value of a param: plain text (muted when the run did not have it), or the name of an entity as a link with its id on hover. */
const ParamWords = (props: Pick<RunParamValueProps, "param">) => {
    const { param } = props
    if (param.href !== "") return <Tooltip content={param.raw} trigger={<Link href={param.href}>{param.value}</Link>} />
    return <Text {...(param.isMissing ? { tone: "muted" as const } : {})}>{param.value}</Text>
}

/** The value of a param, then the source and the notes about it. */
export const RunParamValue = (props: RunParamValueProps) => {
    const { param } = props
    return (
        <Stack gap="identity">
            <ParamWords param={param} />
            {param.source === "" ? null : (
                <Text size="xs" tone="muted">
                    {param.source}
                </Text>
            )}
            {param.isMasked ? (
                <Text size="xs" tone="muted">
                    {props.masked}
                </Text>
            ) : null}
            {param.isMissing && param.source !== "" ? (
                <Text size="xs" tone="muted">
                    {props.missing}
                </Text>
            ) : null}
        </Stack>
    )
}
