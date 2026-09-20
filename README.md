# HireUS

**An AI mock interviewer — and everything after it.** HireUS interviews you for the role you want, scores how you actually delivered your answers, then finds live openings and the real people hiring for them.

![HireUS](docs/hireus.webp)

Built by **Aman Dixit** as a minor project at MITS Gwalior.

## What it does

### Practise
- **Adaptive interviews.** Questions are generated from your target role, industry, experience level and interview type, and each one follows on from what you actually said. A fresher and a senior get genuinely different interviews. Choose 3, 5 or 8 questions.
- **Voice or keyboard.** Speech is transcribed in the browser, each question is read aloud with the most natural voice available, and a live waveform responds to your actual microphone input.
- **Live delivery coaching.** Words, speaking pace (WPM) and filler words are counted as you answer, not just afterwards.
- **Resilient.** Refresh mid-interview and the session resumes where you left off. Skip a question, clear an answer, or mute the interviewer at any point.

### Review
- **A scored report.** Gemini grades four dimensions — confidence, clarity, role knowledge and fluency — with strengths, weaknesses and an action plan.
- **Your answer beside an expert one.** Every question expands to show what you said, what it scored, why, and how a strong candidate would have answered.
- **Printable.** "Save as PDF" produces a clean report with the interface stripped out.

### Apply
- **Job search without the interview.** A standalone `/jobs` page queries five boards at once — Adzuna, Remotive, Jobicy, Arbeitnow and RemoteOK — deduplicates them, interleaves the sources so no single board dominates, and ranks the result against your profile.
- **Resume matching.** Upload a PDF; it is parsed in your browser and turned into a search profile. No interview required.
- **Real hiring contacts.** A `/network` page surfaces employers currently hiring in your field, with the direct address they published, and drafts the intro email for you. Look up any company to get its real domain, careers page and engineers who publish contact details.

### Freelance
- **Find clients, not jobs.** Describe what you sell and who buys it. `/clients` works out which world that client lives in and searches only the databases that can contain them, scores each prospect on how likely they are to reply, and drafts a first email referencing their own work. It drafts; it never sends — messages open in your own mail app, one at a time.

  | If the client is | it searches |
  |---|---|
  | Software, SaaS, developer tools | Hacker News — Show HN, who-is-hiring, the freelancer thread |
  | A cosmetics, soap or fragrance brand | Open Beauty Facts, then resolves the brand to a real domain |
  | A food or drink brand | Open Food Facts, resolved the same way |
  | A shop, salon, studio or workshop | OpenStreetMap businesses that published a contact address |

  Searching Hacker News for a perfume company returns nothing, which is why the
  routing exists.

  **Scale.** The product databases are paged in parallel across many categories
  at once — a soap and fragrance search returns around 1,300 distinct brands
  across 100+ countries in a few seconds. Only the first handful are scored and
  drafted, because each costs a model call; the rest are listed for browsing and
  written individually on request. Filter the result by country or by whether a
  contact address was published.

  **Limits, stated plainly.** Region filtering uses a bounding box, so a search
  for India can include a neighbouring country — every result shows its own
  location. OpenStreetMap is the slowest and least reliable source and runs under
  a 45-second budget, so it often contributes nothing. Brand addresses are common
  company inboxes (`hello@domain`) labelled unverified; OpenStreetMap and Hacker
  News addresses were published by the business itself.

  **Without a model key** the search still runs — discovery is plain HTTP against
  open databases. Routing falls back to keywords, and ranking and drafting are
  skipped with a notice.

## About the contact data

The networking feature only uses information that was published in order to be used:

- **Hacker News "Who is hiring?"** — addresses employers post each month specifically so candidates will write to them.
- **GitHub public profiles** — shown only when the person filled in their own public email or website field.
- **Company domains** — resolved through Clearbit's free autocomplete endpoint; role inboxes such as `careers@` are presented as suggestions to try, never as verified addresses.

It does **not** guess addresses from name patterns, call an enrichment or data-broker API, or scrape LinkedIn. That yields a shorter list than the paid tools, and every entry on it is one you can legitimately contact. LinkedIn and X links are ordinary search URLs you click yourself.

## Stack

| Part | Tech |
|---|---|
| Client | React 19, Vite, Tailwind CSS v4, React Router 7, Web Speech API, Web Audio API |
| Design | The Cupertino system — nine colours, one type family, four radii, two easing curves |
| Server | Node.js, Express 5, Google Gemini (`gemini-2.5-flash`) |
| Data | Adzuna, Remotive, Jobicy, Arbeitnow, RemoteOK, Hacker News (Algolia), GitHub, Clearbit |

Everything except Adzuna and Gemini works without an API key.

## Run it locally

You need Node.js 18+ and a [Gemini API key](https://aistudio.google.com/app/apikey).

[Adzuna credentials](https://developer.adzuna.com/) are optional — without them you lose the regional listings but the four free boards still work.

> **Watch the free-tier quota.** `gemini-2.5-flash` allows 20 requests per day on the free tier, and a single interview plus a job search uses several. When it runs out the app says so plainly rather than hanging, but every AI feature stops until it resets at midnight Pacific. Add billing to the key before a demo.

```bash
# 1. API server (port 5001)
cd server
npm install
cp .env.example .env   # then fill in your keys
npm run dev

# 2. Client, in a second terminal
cd client
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). Speech input works best in Chrome.

To point the client at a different API host, copy `client/.env.example` to `client/.env` and set `VITE_API_URL`.

## API

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Which integrations are configured |
| `POST` | `/start-interview` | First question, built from the candidate profile |
| `POST` | `/next-question` | Reaction to the last answer, plus the next question |
| `POST` | `/analyze-interview` | Scores, feedback and per-question model answers |
| `POST` | `/parse-resume` | Structured profile extracted from resume text |
| `GET` | `/job-search` | Aggregated, deduplicated, ranked openings |
| `GET` | `/job-recommendations` | Alias of `/job-search` |
| `GET` | `/hiring-contacts` | Employers hiring in a field, with published addresses |
| `GET` | `/company-contacts` | One company's domain, inboxes and public profiles |
| `GET` | `/hiring-thread` | Which Hacker News thread is currently being read |
| `POST` | `/find-clients` | Prospects for a freelancer, ranked, each with a drafted email |
| `POST` | `/rewrite-email` | Rewrites one draft shorter, warmer, more direct or more formal |

## Design

The interface follows a single documented system: nine colour tokens, one type
family (SF Pro where available, Public Sans elsewhere) with tracking that changes
sign at 24px, a four-step radius ladder, and exactly two easing curves — one for
movement, a slower one for colour. Sections breathe on a 64–120px band. The accent
is green rather than the system's original blue, because one saturated hue reserved
for the primary action is the rule worth porting, not the specific hue.

## Accessibility and preferences

Dark mode follows the system setting and can be toggled manually. `prefers-reduced-motion` disables every decorative animation. Recording state is announced to screen readers, and the interface is keyboard navigable throughout.
