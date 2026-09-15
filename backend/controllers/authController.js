const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookies');

const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

const USERNAME_RULE = /^[a-z0-9._-]{3,32}$/;

const validate = (username, password) => {
    if (typeof username !== 'string' || typeof password !== 'string') {
        return 'Enter a username and a password.';
    }
    if (!USERNAME_RULE.test(username)) {
        return 'Usernames are 3 to 32 characters, using letters, numbers, dots, dashes or underscores.';
    }
    if (password.length < 8) {
        return 'Passwords need at least 8 characters.';
    }
    if (password.length > 128) {
        return 'That password is too long.';
    }
    return null;
};

// POST /auth/signup
exports.signup = async (req, res, next) => {
    try {
        const rawName = (req.body.username || '').trim();
        const username = rawName.toLowerCase();
        const password = req.body.password || '';

        const problem = validate(username, password);
        if (problem) return res.status(400).json({ message: problem });

        const exists = await User.findOne({ username });
        if (exists) {
            return res.status(409).json({ message: 'That username is taken.' });
        }

        await User.create({ username, displayName: rawName, password });
        return res.status(201).json({ message: 'Account created. Sign in to continue.' });
    } catch (error) {
        // Two people can pass the findOne check at the same time; the unique
        // index is what actually decides, so translate its error.
        if (error.code === 11000) {
            return res.status(409).json({ message: 'That username is taken.' });
        }
        return next(error);
    }
};

// POST /auth/signin
exports.signin = async (req, res, next) => {
    try {
        const username = (req.body.username || '').trim().toLowerCase();
        const password = req.body.password || '';

        if (!username || !password) {
            return res.status(400).json({ message: 'Enter a username and a password.' });
        }

        const user = await User.findOne({ username });
        const ok = user && (await user.matchPassword(password));

        // Same message either way, so the form cannot be used to discover
        // which usernames exist.
        if (!ok) {
            return res.status(401).json({ message: 'Username or password is incorrect.' });
        }

        setAuthCookie(res, generateToken(user._id));

        return res.status(200).json({
            username: user.displayName || user.username,
            onboarded: user.onboarded,
            redirectUrl: user.onboarded ? '/home' : '/onboarding'
        });
    } catch (error) {
        return next(error);
    }
};

// POST /auth/logout  (GET kept as a fallback for plain links)
exports.logout = (req, res) => {
    clearAuthCookie(res);
    // POST comes from the app's own fetch(); GET is a plain link.
    if (req.method === 'POST') {
        return res.status(200).json({ redirectUrl: '/login' });
    }
    return res.redirect('/login');
};
