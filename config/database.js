const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/interview_data';
    
    const options = {
      maxPoolSize: 10, // 维护最多10个socket连接
      serverSelectionTimeoutMS: 5000, // 5秒后超时
      socketTimeoutMS: 45000, // 45秒后关闭socket
      family: 4 // 使用IPv4
    };

    const conn = await mongoose.connect(mongoURI, options);
    
    console.log(`✅ MongoDB连接成功: ${conn.connection.host}`);
    
    // 监听连接事件
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB连接错误:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB连接断开');
    });
    
    // 优雅关闭
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📴 MongoDB连接已关闭');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ MongoDB连接失败:', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;