import { DriveConnectionPage } from "@/features/pages/DriveConnectionPage"

/** The document title of this page. */
export { driveConnectionMetadata as generateMetadata } from "@/features/pages/DriveConnectionPage"

type PageProps = {
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Adapts the Google Drive route to its page owner; the query names the open tab. */
const Page = (props: PageProps) => <DriveConnectionPage searchParams={props.searchParams} />

export default Page
