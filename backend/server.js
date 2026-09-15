require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { protect, redirectIfAuthenticated, requireOnboarding } = require('./middleware/authMiddleware');
const { notFound, errorHandler } = require('./middleware/errorHandler');

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is missing. Copy backend/.env.example to backend/.env first.');
    process.exit(1);
}

connectDB();

const app = express();
app.set('trust proxy', 1); // correct client IPs behind Render/Heroku style proxies

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const FRONTEND = path.join(__dirname, '..', 'frontend');
const PAGES = path.join(FRONTEND, 'pages');
const sendPage = (res, file) => res.sendFile(path.join(PAGES, file));

// Only stylesheets, scripts and images are public. Previously the whole
// frontend folder was static, so /index.html and /landing.html could be opened
// directly and skipped the auth check entirely. HTML now lives in pages/,
// outside the static root, and is only reachable through the routes below.
app.use(
    '/assets',
    express.static(path.join(FRONTEND, 'assets'), {
        maxAge: process.env.NODE_ENV === 'production' ? '7d' : 0
    })
);

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use('/auth', require('./routes/authRoutes'));
app.use('/api', require('./routes/userRoutes'));
app.use('/api', require('./routes/analysisRoutes'));

// --- pages ---------------------------------------------------------------

app.get('/', (req, res) => res.redirect('/home'));

app.get('/login', redirectIfAuthenticated, (req, res) => sendPage(res, 'login.html'));

app.get('/onboarding', protect, (req, res) => {
    if (req.user.onboarded) return res.redirect('/home');
    return sendPage(res, 'onboarding.html');
});

app.get('/home', protect, requireOnboarding, (req, res) => sendPage(res, 'home.html'));
app.get('/app', protect, requireOnboarding, (req, res) => sendPage(res, 'app.html'));

// Old paths from the previous version.
app.get('/landing', (req, res) => res.redirect('/home'));
app.get('/index.html', (req, res) => res.redirect('/app'));

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
