# Social Media Agent — Budget365

## Context

Budget365 è live con utenti reali. L'obiettivo è costruire visibilità e crescita organica sui social (X, Facebook, Reddit) attorno al concept "community-driven features": gli utenti votano le prossime feature, il fondatore le costruisce.

Il fondatore non vuole dedicare tempo alla gestione manuale dei social. La soluzione è un agente AI automatizzato che genera e pubblica contenuti in autonomia, con notifica push al fondatore dopo ogni post. Reddit è semi-manuale (bozze auto-generate, fondatore copia-incolla) per evitare rischi di ban.

---

## Posizionamento

**Pitch**:
> "Budget365 — track spending, grow your savings, invest smarter. Built by the community, for the community."

**3 pilastri del messaggio**:
| Pilastro | Messaggio | Target |
|----------|-----------|--------|
| Control | "Know exactly where every euro goes" | Spenders |
| Growth | "See your savings turn into investments" | Investors |
| Co-creation | "You vote the next feature. I build it." | Entrambi |

**Tono**: diretto, onesto, indie dev. No corporate. Il fondatore parla, non un brand.

---

## Architettura

```
[Cron Scheduler — 3x/settimana]
      │
      ▼
[context.js]
  ├── git log --oneline -20 (commit recenti)
  ├── GET /api/savings/portfolio (metriche app)
  └── features.json (lista feature + stato)
      │
      ▼
[generator.js — Claude API claude-sonnet-4-6]
  ├── Seleziona tipo post (rotazione: build diary / finance tip / feature poll / milestone)
  ├── Genera versione X (≤280 char + eventuali thread)
  └── Genera versione Facebook (expanded, 150-300 parole)
      │
      ├──▶ [poster-x.js] → X API v2 → posta
      │         └──▶ [notify.js] → ntfy.sh push
      ├──▶ [poster-facebook.js] → Graph API → posta nel gruppo
      │         └──▶ [notify.js] → ntfy.sh push
      └──▶ reddit-drafts/YYYY-MM-DD-subreddit.md → fondatore copia-incolla
```

---

## File Structure

```
/social-agent/
├── index.js              # entry point + scheduler (node-cron)
├── context.js            # git log + API metriche + features.json
├── generator.js          # chiama Claude API, restituisce { postX, postFacebook, postType }
├── poster-x.js           # X API v2 con OAuth 1.0a
├── poster-facebook.js    # Facebook Graph API v19+
├── notify.js             # HTTP POST a ntfy.sh
├── features.json         # lista feature (aggiornata manualmente dal fondatore)
├── topics-bank.json      # 20+ topic finanza per finance tips
└── reddit-drafts/        # .md generati automaticamente
```

---

## Dettaglio Componenti

### `features.json`
```json
[
  { "id": "csv-export", "label": "CSV Export", "status": "planned", "votes": 0 },
  { "id": "multi-currency", "label": "Multi-currency support", "status": "planned", "votes": 0 },
  { "id": "shared-budgets", "label": "Shared budgets (couples)", "status": "planned", "votes": 0 }
]
```
Il fondatore aggiorna questo file quando raccoglie voti o completa feature.

### `topics-bank.json`
20+ oggetti, ognuno con `{ title, keyPoints[], hashtags[] }`. Esempi:
- "How to build a monthly budget from scratch"
- "ETF vs stocks: where to park your savings"
- "The 50/30/20 rule — does it actually work?"
- "How I track my savings rate every month"

### `generator.js` — Prompt Claude API

**Input**:
```js
{
  recentCommits: ["fix: recurring transaction scheduling", "feat: portfolio cumulative view"],
  userCount: 142,
  pendingFeatures: ["CSV Export", "Multi-currency"],
  postType: "build_diary" | "finance_tip" | "feature_poll" | "milestone",
  topic: { /* se finance_tip */ }
}
```

**System prompt**:
```
You are the social media voice of Budget365, a personal budget + investment tracking app.
The founder is building this app based on community votes. Tone: direct, honest, indie dev.
No corporate language. No emojis overload (max 1-2 per post).
Hashtags: #buildinpublic #personalfinance #indiehacker #FIRE #budgetapp
```

**Output**:
```js
{
  postX: "string ≤280 chars",
  threadX: ["string", ...] | null,  // se thread necessario
  postFacebook: "string 150-300 words"
}
```

### `poster-x.js`
- Usa `twitter-api-v2` npm package
- OAuth 1.0a (User Context) per postare tweet
- Se `threadX` non null, posta thread in sequenza

### `poster-facebook.js`
- Facebook Graph API v19+
- POST `/{group-id}/feed` con Page Access Token
- Token long-lived (60 giorni). Il fondatore rigenera manualmente ogni 2 mesi (~5 min via Graph API Explorer)

### `notify.js`
```js
async function notify(message) {
  await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
    method: 'POST',
    body: message,
    headers: { 'Title': 'Budget365 Social Agent' }
  });
}
```

### `index.js` — Schedule

```js
// Lunedì 9:00 — Build diary
cron.schedule('0 9 * * 1', () => run('build_diary'));
// Mercoledì 9:00 — Finance tip
cron.schedule('0 9 * * 3', () => run('finance_tip'));
// Venerdì 9:00 — Feature poll
cron.schedule('0 9 * * 5', () => run('feature_poll'));
// Ogni giorno 8:00 — controlla milestone
cron.schedule('0 8 * * *', () => checkMilestones());
```

### Reddit Drafts

Generati ogni venerdì insieme al feature poll. Salvati in:
```
reddit-drafts/2026-05-09-sideprojects.md
reddit-drafts/2026-05-09-personalfinance.md
```

Struttura bozza:
```markdown
# Subreddit: r/sideprojects
# Flair: Show & Tell
# Title: [Show & Tell] Building a budget+investing app — Week 18 update

---

Hey r/sideprojects! Week 18 of building Budget365.

**What shipped this week:**
- [da git log]

**What the community voted for next:**
- CSV Export (top voted)

**Try it:** https://budget-app-keape.vercel.app

Happy to answer questions about the stack (React + RN + Express + MongoDB).
```

---

## Variabili d'Ambiente Necessarie

```env
# Esistenti (non modificare)
MONGODB_URI=...
JWT_SECRET=...

# Nuove — Social Agent
ANTHROPIC_API_KEY=sk-ant-...
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_SECRET=...
FACEBOOK_PAGE_TOKEN=...
FACEBOOK_GROUP_ID=...
NTFY_TOPIC=budget365-keape
```

---

## Setup One-Time

| Step | Piattaforma | Stima tempo |
|------|-------------|-------------|
| Crea app su developer.x.com, ottieni OAuth 1.0a tokens | X | 30 min |
| Crea Facebook Page → crea gruppo → ottieni Page Access Token | Facebook | 45 min |
| Installa app ntfy sul telefono, subscribe al topic | ntfy | 5 min |
| Deploy social-agent/ su Render (nuovo service, free tier) | Render | 20 min |

---

## Reddit Strategy (manuale, ~10 min/mese)

**Subreddit + frequenza**:
| Subreddit | Frequenza | Tipo post |
|-----------|-----------|-----------|
| r/sideprojects | 2x/mese | Show & Tell journey |
| r/IndieHackers | 1x/mese | Metriche + lezioni |
| r/personalfinance | Commenti solo | Rispondi a domande, mai post promozionali |
| r/FIRE | 1x/mese | Savings allocation post |

**Regola d'oro**: 9 contributi di valore → 1 menzione app.

---

## Verifiche End-to-End

1. Avvia agente manualmente: `node social-agent/index.js --dry-run` → output in console senza postare
2. Test post X: `node social-agent/index.js --platform=x --type=finance_tip`
3. Test post Facebook: `node social-agent/index.js --platform=facebook --type=build_diary`
4. Test notifica: `node social-agent/notify.js "test message"` → push sul telefono
5. Verifica reddit-drafts/ contiene file .md ben formattati
6. Simula milestone trigger con `userCount=100` hardcoded

---

## Dipendenze npm da aggiungere

```json
"twitter-api-v2": "^1.17.0",
"node-cron": "^3.0.3",
"node-fetch": "^3.3.2",
"@anthropic-ai/sdk": "^0.30.0"
```
