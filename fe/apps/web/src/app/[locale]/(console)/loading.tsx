"use client"

import { useT } from "@/i18n/client"
import { shell } from "@/i18n/dict/shell"
import { Breadcrumbs, Heading, PageContainer, Skeleton, SurfaceCard } from "@starci/grammar/common"

/** STATE-8 case-5, last resort: a page-shaped skeleton (trail, heading, one card) for a route that has no loading of its own. */
const ConsoleLoading = () => {
    const t = useT(shell)
    return (
        <PageContainer measure="product">
            <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome") }]} />
            <Heading level={1} isSkeleton>
                {t("loading")}
            </Heading>
            <SurfaceCard ariaLabel={t("loading")}>
                <Skeleton shape="text" lines={4} />
            </SurfaceCard>
        </PageContainer>
    )
}

export default ConsoleLoading
