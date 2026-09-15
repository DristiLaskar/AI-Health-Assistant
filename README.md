# AI Health Therapist

Describe how you feel in ordinary language and get back a structured, readable
assessment: what it might be, how confident that is, what you can try now, the
signs that mean you should stop waiting, and questions worth taking to a
clinician.

Built by Dristi Laskar. Node, Express, MongoDB and the Google Gemini API, with a
plain HTML/CSS/JavaScript frontend and no build step.

> This tool gives general health information. It is not a diagnosis and it can be
> wrong. It is not a substitute for a qualified clinician. In an emergency, call
> your local emergency number.

---

## Running it locally

**You need:** Node 18 or newer, npm, and a MongoDB database (local or Atlas).

```bash
cd backend
npm install
cp .env.example .env     # then open .env and fill in the three values
npm start
```

Open <http://localhost:3000>.

`.env` needs three things:

| Key | Where it comes from |
| :-- | :-- |
| `MONGO_URI` | Your Atlas connection string, or `mongodb://127.0.0.1:27017/ai-health-therapist` |
| `JWT_SECRET` | Any long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `GEMINI_API_KEY` | <https://aistudio.google.com/apikey> |

The server refuses to start without `JWT_SECRET` or `MONGO_URI`, rather than
failing later in a confusing way.

---

## How it is put together

```
backend/
  server.js                    routing, page serving, static assets
  config/db.js                 mongoose connection
  models/User.js               account, health profile, recent questions
  middleware/
    authMiddleware.js          protect, redirectIfAuthenticated, requireOnboarding
    errorHandler.js            404 and last-resort error handling
  controllers/
    authController.js          signup, signin, logout
    userController.js          profile and history
    analysisController.js      validates the query, saves to history
  services/gemini.js           the Gemini call, schema and output normalising
  utils/
    cookies.js                 set and clear the auth cookie with matching options
    wantsJson.js               decides between a JSON error and a redirect
  routes/                      auth, user and analysis routes

frontend/
  pages/                       login, onboarding, home, app  (never served statically)
  assets/css/main.css          the whole design system
  assets/js/                   common, login, onboarding, app
```

### Why pages sit outside the static folder

Only `frontend/assets` is served by `express.static`, mounted at `/assets`. The
HTML lives in `frontend/pages` and is only reachable through routes that run the
auth check first. Serving the whole frontend folder statically is what let people
open `/index.html` directly and skip signing in.

### Routes

| Method | Path | Notes |
| :-- | :-- | :-- |
| `GET` | `/login` | Bounces to `/home` if already signed in |
| `GET` | `/onboarding` | Signed in only; bounces to `/home` once complete |
| `GET` | `/home` | Signed in and onboarded |
| `GET` | `/app` | Signed in and onboarded |
| `POST` | `/auth/signup` | |
| `POST` | `/auth/signin` | Sets the `token` cookie, returns where to go next |
| `POST` | `/auth/logout` | |
| `POST` | `/api/onboarding` | Saves the health profile |
| `GET` | `/api/user` | Profile for the sidebar |
| `GET` | `/api/history` | The last few questions asked |
| `POST` | `/api/analyze` | The Gemini call. Rate limited to 8 a minute |
| `GET` | `/health` | Uptime check for the host |

---

## What changed from the first version

### Bugs fixed

- **Anyone could skip the login.** `express.static` served the whole frontend
  folder before the protected routes ran, so `/index.html` and `/landing.html`
  opened straight up. HTML now lives outside the static root.
- **`/api/analyze` threw a 500 for anyone who had not onboarded.** It read
  `healthProfile.diseases.join(...)`, but `healthProfile` is undefined until
  onboarding finishes. The profile is now guarded, and `requireOnboarding`
  stops the request reaching that point at all.
- **An expired session showed raw JSON.** `protect` returned a 401 JSON body on
  page navigations, so you saw `{"message":"Not authorized"}` instead of the login
  screen. Page requests now redirect and clear the stale cookie; only `fetch`
  calls get JSON.
- **A deleted account crashed the request.** `protect` called `next()` even when
  the lookup returned `null`, so everything downstream broke on `req.user`.
- **The rate limit locked you out of your own app.** 10 requests a minute applied
  to all of `/api`, including `/api/user`, which every page load calls. Only the
  Gemini call is throttled now.
- **`npm start` ran `nodemon`,** a devDependency, so deploys failed. `npm start`
  runs `node server.js`; `npm run dev` runs nodemon.
- **Dead code that would have crashed if wired up.** `auth.js` used `req.session`
  with no session middleware and `bcrypt`, which was never installed;
  `database.js` opened a second MongoDB connection and read `MONGODB_URI` while
  the rest of the app read `MONGO_URI`. Both removed, along with `checkModels.js`.
- **Signup accepted anything.** No password length rule, and usernames were not
  normalised, so `Dristi` and `dristi ` were different accounts. Usernames are now
  trimmed and case-folded, with the original kept for display, and the duplicate
  key error is handled for the race the `findOne` check cannot catch.
- **Logout was a `GET`,** so any link or image could trigger it, and the cookie was
  cleared with options that did not match how it was set.
- **`sameSite: 'strict'`** dropped the cookie on some redirect paths; it is `lax` now.
- Sign-in failures now give one message for both a wrong username and a wrong
  password, so the form cannot be used to find out which accounts exist.

### The Gemini integration

`@google/generative-ai@0.2.1` was too old to reach `gemini-2.5-flash`. It is gone;
the call is now a direct REST request using native `fetch`, which means one less
dependency to break.

- The JSON shape is declared to the API as a `responseSchema` instead of being
  scraped out of the reply with `indexOf('{')`.
- Three model names are tried in order, so a retired model degrades instead of
  breaking the feature.
- 45 second timeout, and specific handling for a bad key, exhausted quota, a
  blocked prompt and an empty response.
- Every field is clamped before it reaches the page — scores forced into 1 to 10,
  body regions matched against a known list, arrays capped, strings trimmed. Junk
  from the model cannot break the UI.
- The prompt now asks for an urgency level and red flags, and is told to escalate
  on anything that could be an emergency.

### The frontend

Rewritten in plain HTML, CSS and JavaScript. Tailwind, Chart.js and the animated
background are gone.

- One stylesheet holding the whole design system. Colour is functional: green,
  amber and red only ever signal how serious something is, never decoration.
- The body map is inline SVG and the affected region itself fills in, so there is
  no external image to load and no absolutely positioned pins to misalign.
- Scores are drawn as ten-segment meters in CSS rather than a charting library.
- Everything the API returns is escaped before it reaches the page.
- Keyboard focus is visible, the layout works down to a phone, and
  `prefers-reduced-motion` is respected.

### BMI removed

Gone from the `User` schema, the onboarding flow, the Gemini prompt and the UI.
Height and weight are kept as optional fields, and the freed step now collects
allergies, which is used to keep the suggested remedies safe for you.

---

## Testing

The project was verified by booting the real server with the database and the
Gemini call stubbed, then walking the whole flow: guests are redirected away from
protected pages, the old static bypass returns 404, signup validation holds,
onboarding gates the app, analysis saves to history, and forged or expired cookies
get a redirect on pages but a 401 on API calls.

The Gemini request itself is built and normalised correctly but has not been run
against the live API, so try one real query with your key before relying on it.
