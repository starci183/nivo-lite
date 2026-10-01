import type { ReactNode } from "react";
import { ConsoleShell } from "@/features/shell";
import { getPromoState } from "@/features/promo/queries";
import { getShellData } from "@/features/shell/queries";
import { getSession } from "@/lib/session";

type ConsoleLayoutProps = { readonly children: ReactNode };

/** Authenticated console frame: reads the session and real counts, hands plain data to the shell. */
const ConsoleLayout = async ({ children }: ConsoleLayoutProps) => {
  const session = await getSession();
  const [data, promo] = await Promise.all([getShellData(), getPromoState()]);
  return (
    <ConsoleShell
      workspaceName={session.workspace.name}
      userName={session.userName}
      email={session.email}
      avatarUrl={session.avatarUrl}
      data={data}
      promo={{ hasChatbot: promo.hasChatbot, isFoundingMember: promo.isFoundingMember }}
    >
      {children}
    </ConsoleShell>
  );
};

export default ConsoleLayout;
