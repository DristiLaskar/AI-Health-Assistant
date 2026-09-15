const mongoose = require('mongoose');

const connectDB = async () => {
    const uri = process.env.MONGO_URI;

    if (!uri) {
        console.error('MONGO_URI is missing. Copy .env.example to .env and fill it in.');
        process.exit(1);
    }

    try {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log('Connected to MongoDB.');
    } catch (err) {
        console.error('Could not connect to MongoDB:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB;
