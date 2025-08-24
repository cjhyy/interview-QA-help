const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  // 网页URL
  url: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: '请提供有效的URL地址'
    }
  },
  
  // URL的MD5哈希，用于快速查找和去重
  urlHash: {
    type: String,
    required: true,
    unique: true
  },
  
  // 网页标题
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  

  
  // 关联的面试问答ID数组
  interviewSummaryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InterviewSummarize'
  }],
  
  // 问答数量统计
  qaCount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // 关键词
  keywords: [{
    type: String,
    trim: true,
    maxlength: 50
  }],
  
  // 内容分类
  category: {
    type: String,
    enum: ['技术', '新闻', '教育', '娱乐', '商业', '科学', '其他'],
    default: '其他'
  },
  
  
  // 总结质量评分（1-5）
  qualityScore: {
    type: Number,
    max: 5,
    default: 3
  },
  
  // 处理状态
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'partial'],
    default: 'pending'
  },
  
  // 错误信息（如果处理失败）
  errorMessage: {
    type: String,
    maxlength: 500
  },
  
  // 处理时间统计
  processingTime: {
    scraping: { type: Number, default: 0 }, // 爬取时间（毫秒）
    summarization: { type: Number, default: 0 }, // 总结时间（毫秒）
    total: { type: Number, default: 0 } // 总时间（毫秒）
  },
  
  // 使用的AI模型
  aiModel: {
    type: String,
    default: 'gpt-3.5-turbo'
  },
  
  // 访问次数
  accessCount: {
    type: Number,
    default: 0
  },
  
  // 最后访问时间
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  
  // 创建时间
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  // 更新时间
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true, // 自动管理createdAt和updatedAt
  versionKey: false // 禁用__v字段
});

// 索引优化
summarySchema.index({ createdAt: -1 });
summarySchema.index({ status: 1 });
summarySchema.index({ category: 1 });
summarySchema.index({ 'title': 'text' }); // 全文搜索索引

// 中间件：更新时自动设置updatedAt
summarySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 实例方法：增加访问次数
summarySchema.methods.incrementAccess = function() {
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

// 静态方法：根据URL哈希查找
summarySchema.statics.findByUrlHash = function(urlHash) {
  return this.findOne({ urlHash });
};

// 静态方法：获取热门总结
summarySchema.statics.getPopular = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ accessCount: -1, createdAt: -1 })
    .limit(limit)
    .select('url title qaCount category accessCount createdAt');
};

// 静态方法：获取最新总结
summarySchema.statics.getRecent = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('url title qaCount category createdAt');
};

// 静态方法：搜索总结
summarySchema.statics.search = function(query, limit = 20) {
  return this.find(
    {
      $text: { $search: query },
      status: 'completed'
    },
    { score: { $meta: 'textScore' } }
  )
  .sort({ score: { $meta: 'textScore' } })
  .limit(limit)
  .select('url title qaCount category createdAt');
};

// 虚拟字段：问答摘要
summarySchema.virtual('qaInfo').get(function() {
  return `共 ${this.qaCount} 个面试问答`;
});

// 转换为JSON时包含虚拟字段
summarySchema.set('toJSON', { virtuals: true });
summarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Summary', summarySchema);