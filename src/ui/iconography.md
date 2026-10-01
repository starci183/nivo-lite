# Nivo feature-to-icon source map

This file answers “which icon represents this feature?” Read it before adding or changing an
`IconName`. The table maps PRODUCT MEANINGS, not screens: when the same feature appears in
navigation, a card and an empty state, every placement reuses the same meaning and Heroicon.

The same table is mirrored in `.claude/fe/canon/patterns/icon.md`. A feature-to-glyph decision
changes both copies together: canon carries the cross-repository law, while this source copy stays
beside the code so an author or AI cannot miss it while choosing an icon.

Do not choose a glyph because it resembles the nearest existing one. A new feature either reuses
an existing product meaning deliberately or receives a unique row here and matching entries in
`IconName` and `GLYPHS`.

## Role table

| Placement role | Heroicons family | Rendered size | Use when |
|---|---|---:|---|
| `heading` | `@heroicons/react/24/outline` | `size-6` | The glyph introduces a heading or empty region |
| `leading` | `@heroicons/react/24/outline` | `size-5` | The glyph leads navigation, a row, field, switch or icon control |
| `chip` | `@heroicons/react/16/solid` | `size-4` | The glyph sits inside a compact chip or text action |

Role never changes the feature mapping. `course` remains `BookOpenIcon` in every placement; the
icon leaf selects the outline or micro drawing from the role.

## Feature mapping

| Meaning (`IconName`) | Product feature | Heroicon | Why this glyph owns the feature |
|---|---|---|---|
| `brand` | Academy/learning identity | `AcademicCapIcon` | A graduation cap names education without borrowing the course-reading mark |
| `streak` | Learning streak | `FireIcon` | Fire is the established continuous-streak metaphor |
| `credit` | AI credit/quota | `BoltIcon` | A bolt reads as consumable AI power, distinct from rewards |
| `reward` | Rewards and gift points | `GiftIcon` | A gift names the thing received rather than its numeric balance |
| `course` | Courses and content | `BookOpenIcon` | An open book names study content and course browsing |
| `email` | Email identity | `EnvelopeIcon` | The envelope is the direct address/message metaphor |
| `password` | Password field | `LockClosedIcon` | A closed lock names protected credentials |
| `revealPassword` | Reveal a masked password | `EyeIcon` | An open eye names making the currently hidden secret visible |
| `hidePassword` | Hide a visible password | `EyeSlashIcon` | A crossed eye names returning a visible secret to its masked state |
| `code` | Verification/security code | `ShieldCheckIcon` | The checked shield distinguishes verification from programming |
| `complete` | Completed/successful state | `CheckCircleIcon` | A checked circle names completion across authentication, quests and progress without tying the glyph to one feature |
| `pending` | Incomplete/pending progress | `CircleIcon` | The unfinished state is the exact empty twin of completion: keep Heroicons' outer `CheckCircleIcon` path and remove only its inner check |
| `signIn` | Enter account/session | `ArrowRightStartOnRectangleIcon` (outline), `ArrowRightEndOnRectangleIcon` (chip) | The arrow crossing a boundary names session entry. Heroicons 2.1 split the old `ArrowRightOnRectangleIcon` in two and deprecated that name; the outline cut here is its byte-identical successor `ArrowRightStartOnRectangleIcon`, so the drawing is unchanged |
| `signUp` | Create an account | `UserPlusIcon` | A person with a plus names account creation |
| `close` | Dismiss/close | `XMarkIcon` | The conventional close mark has one unambiguous action |
| `next` | Continue/go forward | `ArrowRightIcon` | A forward arrow names progression without implying login |
| `disclosure` | Open the profile/details named by a row | `ChevronRightIcon` | A chevron denotes disclosure into the row's own destination, not a generic forward action |
| `retry` | Retry/refresh failed work | `ArrowPathIcon` | The circular path names repeating the same operation |
| `send` | Send/submit message | `PaperAirplaneIcon` | The paper plane is reserved for outbound communication |
| `home` | Dashboard overview | `HomeIcon` | Home is the stable entry point to the learner dashboard |
| `explore` | Explore/discover catalogue | `GlobeAltIcon` | A globe names discovery beyond the current collection |
| `community` | Learner community | `UserGroupIcon` | A group names an existing community, distinct from finding talent |
| `league` | Leaderboard and competition | `TrophyIcon` | A trophy names ranking and competitive achievement |
| `review` | Review assigned work | `ClipboardDocumentCheckIcon` | A checked clipboard names a review queue and completed checks |
| `light` | Light theme | `SunIcon` | The sun is the light-theme state |
| `dark` | Dark theme | `MoonIcon` | The moon is the dark-theme state |
| `locale` | Language/locale switch | `LanguageIcon` | The language mark names translation rather than geography |
| `google` | Google provider | `GoogleMark` | The exact provider SVG preserves Google identity |
| `github` | GitHub provider | `GithubMark` | The exact provider SVG preserves GitHub identity |
| `search` | Global search | `MagnifyingGlassIcon` | The magnifier is reserved for finding content |
| `cart` | Shopping cart | `ShoppingCartIcon` | The cart names purchasing and basket state |
| `notification` | Notifications | `BellIcon` | The bell names incoming alerts |
| `account` | Current user account | `UserCircleIcon` | A person in a circle names the signed-in account surface |
| `saved` | Saved/bookmarked content | `BookmarkIcon` | The bookmark names content retained for later |
| `blog` | Blog/editorial content | `NewspaperIcon` | A newspaper names published articles without reusing Explore |
| `talents` | Talent discovery | `SparklesIcon` | Sparkles name exceptional ability without reusing account creation |
| `jobs` | IT jobs | `BriefcaseIcon` | A briefcase names employment and vacancies |
| `practice` | Programming/code practice | `CodeBracketIcon` | Code brackets name programming without reusing verification code |
| `overview` | Console overview | `Squares2X2Icon` | Four equal tiles name the dashboard summary without borrowing the learner Home destination |
| `apps` | Deployed applications | `WindowIcon` | A browser window names a runnable web application without implying creation |
| `agentos` | AgentOS workspaces | `CpuChipIcon` | A processor names the managed agent runtime without borrowing account or automation imagery |
| `servers` | Managed servers | `ServerStackIcon` | The stacked server cut directly names host infrastructure |
| `domains` | Managed domains | `GlobeAmericasIcon` | The globe names internet namespace while remaining distinct from the Explore globe cut |
| `wallet` | Wallet and billing | `WalletIcon` | A wallet names stored balance and payment activity |
| `support` | Product support | `LifebuoyIcon` | A lifebuoy is the established help and assistance metaphor |
| `sidebar` | Toggle the console rail | StarCi `SidebarSimpleIcon` regular path | One stable sidebar glyph preserves the control identity in both expanded and collapsed states; direction is communicated by state and accessible label, not by swapping drawings |

## Selection procedure

Repeated metrics, goals, kind labels, streak captions and compact facts stay text-led when the
legacy reference is text-led. Do not decorate `Content`, a streak count or each goal with its
feature icon. Tiny inline glyphs are reserved for generic state or action meanings that are
actually present in the reference, such as complete, failed, close or disclosure. Navigation,
named entry points and large empty-region headings may retain their reference-backed feature icon.

1. Find the product feature in the mapping table.
2. Reuse its `IconName`; never import the listed Heroicon at the call site.
3. Choose `heading`, `leading` or `chip` from placement, not personal size preference.
4. If no feature matches, add one unique meaning and Heroicon to this table first.
5. Update `IconName` and `GLYPHS` in the same change. The parity test rejects drift and duplicate
   Heroicons across different meanings.
