"use client";

import { SurfaceCard, SurfaceListCard, Text } from "@starci/grammar/common";
import { useT } from "@/i18n/client";
import { responsibilities } from "@/i18n/dict/responsibilities";
import type { OwnerGroupModel } from "./format";
import { GROUPS_CLASS_NAME, SECTION_CLASS_NAME, SECTION_HEAD_CLASS_NAME } from "./classNames";
import { ResponsibilitiesEmpty } from "./empty-state";
import { OwnerMark } from "./owner-mark";
import { ResponsibilityRow } from "./row";

/** Props for {@link OwnerGroups}. */
export type OwnerGroupsProps = {
  groups: ReadonlyArray<OwnerGroupModel>;
  emptyMessage: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  emptyHref?: string;
};

/** Responsibilities grouped by owner: a header per owner, then one card per responsibility, or an empty notice. */
export const OwnerGroups = (props: OwnerGroupsProps) => {
  const t = useT(responsibilities);
  if (props.groups.length === 0) {
    return (
      <SurfaceCard ariaLabel={t("groupAria")}>
        <ResponsibilitiesEmpty
          message={props.emptyMessage}
          description={props.emptyDescription}
          actionLabel={props.emptyActionLabel}
          href={props.emptyHref}
        />
      </SurfaceCard>
    );
  }
  return (
    <div className={GROUPS_CLASS_NAME}>
      {props.groups.map((group) => (
        <section key={group.key} className={SECTION_CLASS_NAME} aria-label={t("groupOwnedBy", { name: group.name })}>
          <div className={SECTION_HEAD_CLASS_NAME}>
            <OwnerMark kind={group.kind} name={group.name} handle={group.handle} />
            <Text size="sm" tone="muted">{t(group.rows.length === 1 ? "countOne" : "countMany", { n: group.rows.length })}</Text>
          </div>
          <SurfaceListCard ariaLabel={t("groupCards", { name: group.name })}>
            {group.rows.map((row) => (
              <ResponsibilityRow key={row.id} row={row} />
            ))}
          </SurfaceListCard>
        </section>
      ))}
    </div>
  );
};
