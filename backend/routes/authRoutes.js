const express = require('express');
const router = express.Router();
const { signup, signin, logout } = require('../controllers/authController');

router.post('/signup', signup);
router.post('/signin', signin);
router.post('/logout', logout);
router.get('/logout', logout); // fallback for plain links

module.exports = router;
