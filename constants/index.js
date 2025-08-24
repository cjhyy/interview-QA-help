/**
 * 应用常量配置
 */

// 总结状态
const SUMMARY_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

// 内容分类
const CONTENT_CATEGORIES = {
  TECHNOLOGY: '技术',
  NEWS: '新闻',
  EDUCATION: '教育',
  BUSINESS: '商业',
  ENTERTAINMENT: '娱乐',
  HEALTH: '健康',
  SCIENCE: '科学',
  SPORTS: '体育',
  TRAVEL: '旅游',
  LIFESTYLE: '生活',
  OTHER: '其他'
};

// 质量评分范围
const QUALITY_SCORE = {
  MIN: 0,
  MAX: 5,
  DEFAULT: 3
};

// 分页限制
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 50,
  MIN_LIMIT: 1
};

// 缓存配置
const CACHE = {
  SUMMARY_TTL: 3600, // 1小时
  LIST_TTL: 300,     // 5分钟
  SEARCH_TTL: 600    // 10分钟
};

// 文本长度限制
const TEXT_LIMITS = {
  TITLE_MAX: 200,
  SUMMARY_MAX: 2000,
  CONTENT_MAX: 50000,
  KEYWORD_MAX: 50,
  ERROR_MESSAGE_MAX: 500
};

// AI模型配置
const AI_CONFIG = {
  DEFAULT_MODEL: 'gpt-3.5-turbo',
  ZHIPU_MODEL: 'glm-4',
  MAX_TOKENS: 1000,
  TEMPERATURE: 0.3,
  TIMEOUT: 60000
};

// 搜索配置
const SEARCH_CONFIG = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 50
};

// 速率限制
const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15分钟
  MAX_REQUESTS: 100,         // 最大请求数
  MESSAGE: '请求过于频繁，请稍后再试'
};

// HTTP状态码
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TIMEOUT: 408,
  PAYLOAD_TOO_LARGE: 413,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// 正则表达式
const REGEX = {
  URL: /^https?:\/\/.+/,
  MONGO_ID: /^[0-9a-fA-F]{24}$/
};

module.exports = {
  SUMMARY_STATUS,
  CONTENT_CATEGORIES,
  QUALITY_SCORE,
  PAGINATION,
  CACHE,
  TEXT_LIMITS,
  AI_CONFIG,
  SEARCH_CONFIG,
  RATE_LIMIT,
  HTTP_STATUS,
  REGEX
};