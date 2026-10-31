import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { DriveConnectionPageBase } from "./component"

/** The document title of the Google Drive page. */
export const driveConnectionMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("driveConnection")
    return { title: t("title") }
}

/**
 * The page of the workspace's Google Drive grant (owner | manager): a server shell. The header, the health tiles, the steps and the
 * progress of the files each read their own data in the browser.
 */
export const DriveConnectionPage = () => <DriveConnectionPageBase />
