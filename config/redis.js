const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  try {
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: process.env.REDIS_DB || 0,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
    };

    // 创建Redis客户端
    redisClient = redis.createClient({
      socket: {
        host: redisConfig.host,
        port: redisConfig.port,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('❌ Redis重连次数过多，停止重连');
            return new Error('Redis重连失败');
          }
          return Math.min(retries * 50, 500);
        }
      },
      password: redisConfig.password,
      database: redisConfig.db
    });

    // 监听连接事件
    redisClient.on('connect', () => {
      console.log('🔄 Redis正在连接...');
    });

    redisClient.on('ready', () => {
      console.log('✅ Redis连接成功');
    });

    redisClient.on('error', (err) => {
      console.error('❌ Redis连接错误:', err.message);
    });

    redisClient.on('end', () => {
      console.log('📴 Redis连接已关闭');
    });

    // 连接到Redis
    await redisClient.connect();

    // 优雅关闭
    process.on('SIGINT', async () => {
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log('📴 Redis连接已关闭');
      }
    });

  } catch (error) {
    console.error('❌ Redis连接失败:', error.message);
    // Redis连接失败不应该阻止应用启动
    console.log('⚠️ 应用将在没有Redis缓存的情况下运行');
  }
};

// Redis缓存工具函数
const cacheUtils = {
  // 设置缓存
  async set(key, value, expireInSeconds = 3600) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        console.warn('⚠️ Redis未连接，跳过缓存设置');
        return false;
      }
      
      const serializedValue = JSON.stringify(value);
      await redisClient.setEx(key, expireInSeconds, serializedValue);
      return true;
    } catch (error) {
      console.error('❌ Redis设置缓存失败:', error.message);
      return false;
    }
  },

  // 获取缓存
  async get(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        console.warn('⚠️ Redis未连接，跳过缓存获取');
        return null;
      }
      
      const value = await redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('❌ Redis获取缓存失败:', error.message);
      return null;
    }
  },

  // 删除缓存
  async del(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        console.warn('⚠️ Redis未连接，跳过缓存删除');
        return false;
      }
      
      await redisClient.del(key);
      return true;
    } catch (error) {
      console.error('❌ Redis删除缓存失败:', error.message);
      return false;
    }
  },

  // 检查键是否存在
  async exists(key) {
    try {
      if (!redisClient || !redisClient.isOpen) {
        return false;
      }
      
      const result = await redisClient.exists(key);
      return result === 1;
    } catch (error) {
      console.error('❌ Redis检查键存在失败:', error.message);
      return false;
    }
  }
};

module.exports = {
  connectRedis,
  getRedisClient: () => redisClient,
  cache: cacheUtils
};