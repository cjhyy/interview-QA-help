const validator = require('validator');

/**
 * URL验证中间件
 */
const validateUrl = (req, res, next) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({
      success: false,
      error: '请提供网页URL'
    });
  }
  
  if (!validator.isURL(url, { protocols: ['http', 'https'] })) {
    return res.status(400).json({
      success: false,
      error: '请提供有效的URL地址'
    });
  }
  
  next();
};

/**
 * ID参数验证中间件
 */
const validateId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: `缺少${paramName}参数`
      });
    }
    
    if (!validator.isMongoId(id)) {
      return res.status(400).json({
        success: false,
        error: `无效的${paramName}格式`
      });
    }
    
    next();
  };
};

/**
 * 搜索参数验证中间件
 */
const validateSearch = (req, res, next) => {
  const { q } = req.query;
  
  if (!q || q.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: '搜索关键词至少需要2个字符'
    });
  }
  
  next();
};

/**
 * 分页参数验证中间件
 */
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  req.query.page = Math.max(1, parseInt(page) || 1);
  req.query.limit = Math.min(50, Math.max(1, parseInt(limit) || 10));
  
  next();
};

module.exports = {
  validateUrl,
  validateId,
  validateSearch,
  validatePagination
};