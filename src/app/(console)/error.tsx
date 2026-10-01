"use client";

import { useT } from "@/i18n/client";
import { shell } from "@/i18n/dict/shell";
import { EmptyNotice, PageContainer } from "@starci/grammar/common";

type ConsoleErrorProps = { readonly reset: () => void };

/** Route error boundary: says what failed and offers a retry. */
const ConsoleError = ({ reset }: ConsoleErrorProps) => {
  const t = useT(shell);
  return (
  <PageContainer measure="reading">
    <EmptyNotice
      message={t("errorTitle")}
      description={t("errorText")}
      actionLabel={t("retry")}
      onAction={reset}
    />
  </PageContainer>
  );
};

export default ConsoleError;
