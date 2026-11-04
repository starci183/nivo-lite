import { Avatar, Cluster, IdentityLockup, Text } from "@starci/grammar/common"

/** The business a public page speaks for, in the bar. */
interface PublicBrandProps {
    /** The business name; while the page loads it is unknown and the mark and name draw as geometry of the same box. */
    readonly name: string
    readonly isLoading?: boolean
}

/** The business mark and name at the start of a public page's bar: the visitor never signs in, so this is the page's identity. */
export const PublicBrand = (props: PublicBrandProps) => {
    if (props.isLoading === true) {
        return (
            <Cluster gap="inline">
                <Avatar name={props.name} shape="rounded" size="control" isLoading />
                <Text isLoading>{props.name}</Text>
            </Cluster>
        )
    }
    return <IdentityLockup title={props.name} markShape="rounded" size="control" />
}
