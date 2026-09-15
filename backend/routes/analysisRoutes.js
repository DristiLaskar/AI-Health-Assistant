const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { analyzeHealth } = require('../controllers/analysisController');
const { protect, requireOnboarding } = require('../middleware/authMiddleware');

// Only the expensive AI call is throttled. The old code limited all of /api,
// so simply loading a page twice could lock the user out.
const analyseLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) =>
        res.status(429).json({ message: 'That is a lot of requests. Give it a minute and try again.' })
});

router.post('/analyze', protect, requireOnboarding, analyseLimiter, analyzeHealth);

module.exports = router;
