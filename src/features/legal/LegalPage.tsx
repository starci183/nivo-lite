import { Alert, Heading, List, ListItem, PageContainer, SectionHeader, Text, TextAction } from "@starci/grammar/common";
import type { Locale } from "@/i18n/core";
import { getLocale } from "@/i18n/server";
import { LandingFooter } from "@/features/landing/bottom/footer";
import { LandingNav } from "@/features/landing/nav";
import { LEGAL_MAIN, LEGAL_SECTION, LEGAL_STACK } from "./classNames";
import { LIMITED_USE_NOTE_VI } from "./privacy";
import type { LegalDoc } from "./types";

const GOOGLE_POLICY_URL = "https://developers.google.com/terms/api-services-user-data-policy";
/** Google's wording: stays in English in both languages. */
const LIMITED_USE_SENTENCE =
  "NIVO's use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.";

/** Public legal document on the landing chrome. TODO(owner/lawyer): content is a draft until approved. */
export const LegalPage = async ({ build }: { readonly build: (locale: Locale) => LegalDoc }) => {
  const locale = await getLocale();
  const doc = build(locale);
  return (
    <>
      <LandingNav anchorBase="/" />
      <main className={LEGAL_MAIN}>
        <PageContainer measure="reading">
          <div className={LEGAL_STACK}>
            <Alert tone="cautionary">{doc.draft}</Alert>
            <SectionHeader level={1} title={doc.title} description={doc.intro} />
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className={LEGAL_SECTION} aria-label={s.title}>
                <Heading level={2}>{s.title}</Heading>
                {s.paragraphs?.map((p) => <Text key={p}>{p}</Text>)}
                {s.items ? <List>{s.items.map((i) => <ListItem key={i}><Text>{i}</Text></ListItem>)}</List> : null}
                {s.afterItems?.map((p) => <Text key={p}>{p}</Text>)}
                {s.limitedUse ? (
                  <>
                    <Text>{LIMITED_USE_SENTENCE}</Text>
                    <Text size="sm">
                      <TextAction href={GOOGLE_POLICY_URL} target="_blank" rel="noopener noreferrer">{GOOGLE_POLICY_URL}</TextAction>
                    </Text>
                    {locale === "vi" ? <Text tone="muted">{LIMITED_USE_NOTE_VI}</Text> : null}
                  </>
                ) : null}
              </section>
            ))}
          </div>
        </PageContainer>
      </main>
      <LandingFooter anchorBase="/" />
    </>
  );
};
