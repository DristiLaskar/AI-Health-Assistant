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
## Testing

The project was verified by booting the real server with the database and the
Gemini call stubbed, then walking the whole flow: guests are redirected away from
protected pages, the old static bypass returns 404, signup validation holds,
onboarding gates the app, analysis saves to history, and forged or expired cookies
get a redirect on pages but a 401 on API calls.

The Gemini request itself is built and normalised correctly but has not been run
against the live API, so try one real query with your key before relying on it.
