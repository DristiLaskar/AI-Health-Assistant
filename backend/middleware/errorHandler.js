const wantsJson = require('../utils/wantsJson');

// Anything that reaches here is unexpected, so log it in full but tell the
// user something plain. Without this, a thrown error left requests hanging.
exports.notFound = (req, res) => {
    if (wantsJson(req)) {
        return res.status(404).json({ message: 'Not found.' });
    }
    return res.status(404).send('Page not found. <a href="/">Go home</a>.');
};

exports.errorHandler = (err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    if (wantsJson(req)) {
        return res.status(status).json({ message: 'Something went wrong on our side.' });
    }
    return res.status(status).send('Something went wrong. <a href="/">Go home</a>.');
};
