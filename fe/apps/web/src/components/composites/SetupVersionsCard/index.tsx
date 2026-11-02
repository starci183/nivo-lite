import { EmptyNotice, Section, type ListRowData } from "@starci/grammar/common"

/** The applied versions of the setup in the reader language. */
type SetupVersionsCardProps = {
    readonly title: string
    readonly emptyText: string
    readonly inUseLabel: string
    readonly versions: ReadonlyArray<{
        readonly id: string
        readonly line: string
        readonly detail: string
        readonly isActive: boolean
    }>
    readonly isLoading: boolean
}

/** The immutable versions applied so far, the one in use marked. */
export const SetupVersionsCard = (props: SetupVersionsCardProps) => (
    <Section
        kind="list"
        title={props.title}
        isLoading={props.isLoading === true}
        items={props.versions.map((version): ListRowData => ({
            id: version.id,
            title: version.line,
            description: version.detail,
            ...(version.isActive ? { badges: [{ label: props.inUseLabel, tone: "success", isDot: true }] } : {}),
        }))}
        empty={<EmptyNotice message={props.emptyText} />}
    />
)
