const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

// A cookie is only removed by the browser if the clearing options match the
// options it was set with. Keeping both in one place prevents the classic
// "logout does nothing" bug.
const baseOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
});

exports.setAuthCookie = (res, token) => {
    res.cookie('token', token, { ...baseOptions(), maxAge: THIRTY_DAYS });
};

exports.clearAuthCookie = (res) => {
    res.clearCookie('token', baseOptions());
};
