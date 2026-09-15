const User = require('../models/User');

const GENDERS = ['Female', 'Male', 'Other', 'Prefer not to say'];

const cleanTags = (value) => {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => String(item).trim())
        .filter((item) => item.length > 0 && item.length <= 40)
        .slice(0, 15);
};

const optionalNumber = (value, min, max) => {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) return undefined;
    return Math.round(n);
};

// POST /api/onboarding
exports.saveOnboardingData = async (req, res, next) => {
    try {
        const gender = GENDERS.includes(req.body.gender) ? req.body.gender : null;
        const age = optionalNumber(req.body.age, 1, 120);

        if (!gender) {
            return res.status(400).json({ message: 'Choose how you would like to be described.' });
        }
        if (!age) {
            return res.status(400).json({ message: 'Enter an age between 1 and 120.' });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'That account no longer exists.' });

        user.healthProfile = {
            gender,
            age,
            height: optionalNumber(req.body.height, 50, 260),
            weight: optionalNumber(req.body.weight, 10, 400),
            conditions: cleanTags(req.body.conditions),
            allergies: cleanTags(req.body.allergies)
        };
        user.onboarded = true;
        await user.save();

        return res.status(200).json({ message: 'Profile saved.', redirectUrl: '/home' });
    } catch (error) {
        return next(error);
    }
};

// GET /api/user
exports.getUser = (req, res) => {
    const profile = req.user.healthProfile || {};
    return res.json({
        username: req.user.displayName || req.user.username,
        onboarded: req.user.onboarded,
        profile: {
            gender: profile.gender || null,
            age: profile.age || null,
            height: profile.height || null,
            weight: profile.weight || null,
            conditions: profile.conditions || [],
            allergies: profile.allergies || []
        }
    });
};

// GET /api/history
exports.getHistory = (req, res) => {
    const history = (req.user.history || []).slice(-8).reverse();
    return res.json({ history });
};
