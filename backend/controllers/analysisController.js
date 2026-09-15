const User = require('../models/User');
const { analyse } = require('../services/gemini');

const MAX_LENGTH = 1500;

// POST /api/analyze
exports.analyzeHealth = async (req, res, next) => {
    const problem = typeof req.body.problem === 'string' ? req.body.problem.trim() : '';

    if (problem.length < 5) {
        return res.status(400).json({ message: 'Describe how you are feeling in a sentence or two.' });
    }
    if (problem.length > MAX_LENGTH) {
        return res.status(400).json({ message: `Keep it under ${MAX_LENGTH} characters.` });
    }

    try {
        // healthProfile is undefined for anyone who skipped onboarding, which is
        // what used to throw on profile.diseases.join().
        const profile = (req.user.healthProfile && req.user.healthProfile.toObject)
            ? req.user.healthProfile.toObject()
            : req.user.healthProfile || {};

        const { data } = await analyse(problem, profile);

        // Keep a short trail so the person can look back at what they asked.
        await User.findByIdAndUpdate(req.user.id, {
            $push: {
                history: {
                    $each: [{
                        query: problem.slice(0, 300),
                        summary: data.summary.slice(0, 300),
                        urgency: data.urgency,
                        createdAt: new Date()
                    }],
                    $slice: -20
                }
            }
        });

        return res.status(200).json(data);
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }
        return next(error);
    }
};
