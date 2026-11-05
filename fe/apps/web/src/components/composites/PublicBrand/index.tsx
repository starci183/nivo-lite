import { Avatar, Cluster, IdentityLockup, Text } from "@starci/grammar/common"
import { NivoLogo } from "@/components/leaves/NivoLogo"

/** Unseen text that gives the loading name the width of a real one. */
const GHOST = "M".repeat(16)

/** The business a public page speaks for, in the bar. */
interface PublicBrandProps {
    /** The business name; null when the page has no business to show (not found, failed), and the platform's own mark stands in. */
    readonly name: string | null
    /** The business is still being read: the mark and name draw as geometry of the same box. */
    readonly isLoading?: boolean
    /** The spoken name of the platform mark that stands in when there is no business. */
    readonly fallbackLabel: string
}

/** The business mark and name at the start of a public page's bar: the visitor never signs in, so this is the page's identity. */
export const PublicBrand = (props: PublicBrandProps) => {
    if (props.isLoading === true) {
        return (
            <Cluster gap="inline">
                <Avatar name={GHOST} shape="rounded" size="control" isLoading />
                <Text isLoading>{GHOST}</Text>
            </Cluster>
        )
    }
    if (props.name === null) return <NivoLogo label={props.fallbackLabel} />
    return <IdentityLockup title={props.name} markShape="rounded" markTone="accent" size="control" />
}
