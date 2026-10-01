import { notFound } from "next/navigation";
import { SettingsScreen } from "@/features/module-settings/SettingsScreen";
import { isManagerRole } from "@/lib/members-shared";
import { getInstallation } from "@/lib/modules-core";
import { isModuleKey } from "@/lib/modules-shared";
import { getSession } from "@/lib/session";

type SettingsPageProps = { params: Promise<{ module: string }> };

/** Settings tab: display name, operating mode, live switch and (chatbot) the Telegram channel. */
const SettingsPage = async ({ params }: SettingsPageProps) => {
  const { module } = await params;
  if (!isModuleKey(module)) notFound();
  const [installation, session] = await Promise.all([getInstallation(module), getSession()]);
  if (!installation) notFound();
  // Presence only: the token itself never leaves the server.
  const telegramConnected = module === "chatbot" && Boolean(process.env.TELEGRAM_BOT_TOKEN);
  return <SettingsScreen installation={installation} canEdit={isManagerRole(session.member.role)} telegramConnected={telegramConnected} />;
};

export default SettingsPage;
