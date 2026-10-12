"use client"

import { Alert, Breadcrumbs, PageContainer, SectionHeader, type BreadcrumbItem } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { shell } from "@/i18n/dict/shell"
import { ROUTE_ERROR_HEAD_CLASS, ROUTE_ERROR_PAGE_CLASS } from "./classNames"

/** Props for {@link RouteError}. */
export type RouteErrorProps = {
  /** The page's own trail (the current page last). */
  readonly crumbs: ReadonlyArray<BreadcrumbItem>
  /** The page's own heading: it stays real when the data fails. */
  readonly title: string
  /** What could not load, in the page's words; defaults to the shell's generic line. */
  readonly message?: string
  /** Retry the route (Next's error boundary `reset`, or a router refresh). */
  readonly onRetry?: () => void
}

/**
 * STATE-8 case-4: a route whose data failed keeps its chrome and anatomy - the trail and the heading stay real - and the body is
 * one negative Alert that says what failed and offers the safe retry. Never a blank frame or a generic error page.
 */
export const RouteError = ({ crumbs, title, message, onRetry }: RouteErrorProps) => {
  const t = useT(shell)
  return (
    <PageContainer measure="product">
      <div className={ROUTE_ERROR_PAGE_CLASS}>
        <div className={ROUTE_ERROR_HEAD_CLASS}>
          <Breadcrumbs label={t("crumbLabel")} items={crumbs} />
          <SectionHeader level={1} title={title} />
        </div>
        <Alert
          tone="negative"
          title={t("errorTitle")}
          description={message ?? t("errorText")}
          {...(onRetry ? { action: { label: t("retry"), onAction: onRetry } } : {})}
        />
      </div>
    </PageContainer>
  )
}
