import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { PermissionPanes } from "@/components/blocks/PermissionPanes"

/** The document title of the page. */
export const permissionsMetadata = async (): Promise<Metadata> => {
    const t = await getTranslations("permissions")
    return { title: t("title") }
}

/** The permissions route: the panes block is its root and draws the one `Page` of the rules and the open rule's form. */
export const PermissionsPage = () => <PermissionPanes />
