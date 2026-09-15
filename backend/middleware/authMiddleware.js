const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { clearAuthCookie } = require('../utils/cookies');

// A browser asking for a page should be sent to the login screen.
// A fetch() call from our own JavaScript should get JSON back.
const wantsJson = require('../utils/wantsJson');

const reject = (req, res, message) => {
    clearAuthCookie(res);
    if (wantsJson(req)) {
        return res.status(401).json({ message });
    }
    return res.redirect('/login');
};

exports.protect = async (req, res, next) => {
    const token = req.cookies && req.cookies.token;

    if (!token) {
        return reject(req, res, 'You are not signed in.');
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        // The token was valid but the account no longer exists. The old code
        // called next() here, so every downstream handler blew up on req.user.
        if (!user) {
            return reject(req, res, 'That account no longer exists.');
        }

        req.user = user;
        return next();
    } catch (error) {
        return reject(req, res, 'Your session has expired. Please sign in again.');
    }
};

// Used on the login page so a signed-in visitor is not shown the form again.
exports.redirectIfAuthenticated = async (req, res, next) => {
    const token = req.cookies && req.cookies.token;
    if (!token) return next();

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('onboarded');
        if (!user) return next();
        return res.redirect(user.onboarded ? '/home' : '/onboarding');
    } catch (error) {
        return next();
    }
};

// Anything past onboarding needs a completed profile, otherwise the AI prompt
// is built from undefined fields.
exports.requireOnboarding = (req, res, next) => {
    if (!req.user.onboarded) {
        if (wantsJson(req)) {
            return res.status(403).json({
                message: 'Finish setting up your profile first.',
                redirectUrl: '/onboarding'
            });
        }
        return res.redirect('/onboarding');
    }
    return next();
};
