"use client"

import { Breadcrumbs, PageContainer, SectionHeader } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { team as dict } from "@/i18n/dict/team"
import { HEAD_CLASS, PAGE_CLASS } from "./classNames"
import { InviteForm } from "./InviteForm"
import { InvitesList } from "./InvitesList"
import { MembersList } from "./MembersList"
import type { TeamData } from "./queries"

/** Props for {@link TeamView}. */
export type TeamViewProps = {
  /** The team's data; null while it loads. */
  readonly data: TeamData | null
  /** STATE-8: the same page while its data loads - headings and labels stay, members and invitations are skeleton rows. */
  readonly isLoading?: boolean
}

/** The Team page body (owner | manager): members, pending invitations, invite form. */
export const TeamView = ({ data, isLoading = false }: TeamViewProps) => {
  const t = useT(dict)
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS}>
        <div className={HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "team", label: t("title") }]} />
          <SectionHeader level={1} eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
        </div>
        <MembersList members={data?.members ?? []} staffNames={data?.staffNames ?? {}} selfId={data?.selfId ?? ""} selfRole={data?.selfRole ?? "staff"} isLoading={isLoading} />
        <InvitesList invites={data?.invites ?? []} isLoading={isLoading} />
        <InviteForm staffChoices={data?.staffChoices ?? []} isLoading={isLoading} />
      </div>
    </PageContainer>
  )
}
