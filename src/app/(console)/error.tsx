"use client";

import { RouteError } from "@/components/state/RouteError";
import { useT } from "@/i18n/client";
import { shell } from "@/i18n/dict/shell";

type ConsoleErrorProps = { readonly reset: () => void };

/** STATE-8 case-5, last resort: a route without its own error view keeps the shell trail and heading, with one Alert and a retry. */
const ConsoleError = ({ reset }: ConsoleErrorProps) => {
  const t = useT(shell);
  return <RouteError crumbs={[{ id: "home", label: t("crumbHome") }]} title={t("crumbHome")} onRetry={reset} />;
};

export default ConsoleError;
