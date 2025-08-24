/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  console.error('❌ 服务器错误:', err);
  
  // 默认错误信息
  let error = {
    success: false,
    error: '服务器内部错误'
  };
  
  // MongoDB验证错误
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    error.error = messages.join(', ');
    return res.status(400).json(error);
  }
  
  // MongoDB重复键错误
  if (err.code === 11000) {
    error.error = '数据已存在';
    return res.status(400).json(error);
  }
  
  // JWT错误
  if (err.name === 'JsonWebTokenError') {
    error.error = '无效的令牌';
    return res.status(401).json(error);
  }
  
  // 请求体过大错误
  if (err.type === 'entity.too.large') {
    error.error = '请求数据过大';
    return res.status(413).json(error);
  }
  
  // 超时错误
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    error.error = '请求超时，请稍后重试';
    return res.status(408).json(error);
  }
  
  // 网络连接错误
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    error.error = '网络连接失败';
    return res.status(503).json(error);
  }
  
  // 自定义错误
  if (err.statusCode) {
    error.error = err.message || '请求失败';
    return res.status(err.statusCode).json(error);
  }
  
  // 默认500错误
  res.status(500).json(error);
};

/**
 * 404错误处理中间件
 */
const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: '请求的资源不存在'
  });
};

/**
 * 异步错误捕获包装器
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFound,
  asyncHandler
};