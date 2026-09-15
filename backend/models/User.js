const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const HistorySchema = new mongoose.Schema(
    {
        query: String,
        summary: String,
        urgency: String,
        createdAt: { type: Date, default: Date.now }
    },
    { _id: false }
);

const UserSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            minlength: 3,
            maxlength: 32
        },
        displayName: { type: String, trim: true, maxlength: 32 },
        password: { type: String, required: true },
        onboarded: { type: Boolean, default: false },
        healthProfile: {
            gender: String,
            age: Number,
            height: Number,
            weight: Number,
            conditions: { type: [String], default: [] },
            allergies: { type: [String], default: [] }
        },
        history: { type: [HistorySchema], default: [] }
    },
    { timestamps: true }
);

// Hash the password whenever it is set or changed.
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

UserSchema.methods.matchPassword = function (entered) {
    return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model('User', UserSchema);
