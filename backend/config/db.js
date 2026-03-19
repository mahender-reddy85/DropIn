import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI && process.env.NODE_ENV === 'production') {
      console.error('FATAL ERROR: MONGO_URI is not defined in the environment variables.');
      process.exit(1);
    }
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/dropin';
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
