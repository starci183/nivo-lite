"use client";

import { Breadcrumbs, Button, PageContainer, SectionHeader } from "@starci/grammar/common";
import { PAGE_CLASS_NAME } from "@/features/overview/classNames";
import { useT } from "@/i18n/client";
import { responsibilities as dict } from "@/i18n/dict/responsibilities";
import { ResponsibilityBoard, type BoardInitialFilters } from "./board";
import { HEAD_CLASS_NAME } from "./classNames";
import type { ResponsibilityRowModel } from "./format";

/** Props for {@link ResponsibilitiesView}. */
export type ResponsibilitiesViewProps = {
  readonly rows: Array<ResponsibilityRowModel>;
  readonly initial: BoardInitialFilters;
  /** "Updated <time>" line of the header; unknown while the page loads. */
  readonly description?: string;
  readonly verifiedLabel: string;
  /** STATE-8: the same page while its data loads - heading, tabs and filters stay, counts and the list are skeletons. */
  readonly isLoading?: boolean;
};

/** Responsibility board page: every responsibility by owner, filterable by status and due. */
export const ResponsibilitiesView = ({ rows, initial, description, verifiedLabel, isLoading = false }: ResponsibilitiesViewProps) => {
  const t = useT(dict);
  return (
    <PageContainer measure="product">
      <div className={PAGE_CLASS_NAME}>
        <div className={HEAD_CLASS_NAME}>
          <Breadcrumbs label={t("crumbLabel")} items={[{ id: "home", label: t("crumbHome"), href: "/dashboard" }, { id: "responsibilities", label: t("pageTitle") }]} />
          <SectionHeader
            level={1}
            eyebrow={t("eyebrow")}
            title={t("pageTitle")}
            description={description}
            action={<Button variant="primary" href="/leads?new=1">{t("newLead")}</Button>}
          />
        </div>
        <ResponsibilityBoard key={`${initial.status}-${initial.due}`} rows={rows} initial={initial} verifiedLabel={verifiedLabel} isLoading={isLoading} />
      </div>
    </PageContainer>
  );
};
