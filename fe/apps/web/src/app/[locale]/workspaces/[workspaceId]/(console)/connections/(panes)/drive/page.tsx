import type { ReactElement } from "react"
import { DriveRedirectPage } from "@/features/pages/DriveRedirectPage"

export { driveRedirectMetadata as generateMetadata } from "@/features/pages/DriveRedirectPage"

/** What the page receives from Next. */
interface DriveRouteProps {
    readonly params: Promise<{ readonly workspaceId: string }>
    readonly searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Moved: the old Drive address forwards to the Google account page. */
const Page = async ({ params, searchParams }: DriveRouteProps): Promise<ReactElement> => {
    const [{ workspaceId }, query] = await Promise.all([params, searchParams])
    return <DriveRedirectPage workspaceId={workspaceId} query={query} />
}

export default Page
