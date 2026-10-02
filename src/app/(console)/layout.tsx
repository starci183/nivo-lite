import type { ReactNode } from "react";
import { ConsoleShell } from "@/features/shell";
import { getShellData, getShellPromoFlags } from "@/features/shell/queries";
import { getSession } from "@/lib/session";

type ConsoleLayoutProps = { readonly children: ReactNode };

/** Authenticated console frame: reads the session and real counts, hands plain data to the shell. */
const ConsoleLayout = async ({ children }: ConsoleLayoutProps) => {
  const session = await getSession();
  const [data, promo] = await Promise.all([getShellData(), getShellPromoFlags()]);
  return (
    <ConsoleShell
      workspaceName={session.workspace.name}
      userName={session.userName}
      email={session.email}
      avatarUrl={session.avatarUrl}
      data={data}
      promo={promo}
    >
      {children}
    </ConsoleShell>
  );
};

export default ConsoleLayout;
