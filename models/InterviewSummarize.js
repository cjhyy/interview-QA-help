const mongoose = require('mongoose');

// 面试问答总结模式
const interviewSummarizeSchema = new mongoose.Schema({
  // 关联的原始总结ID
  summaryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Summary',
    required: true,
    index: true
  },
  
  // URL哈希值，用于快速查找
  urlHash: {
    type: String,
    required: true,
    index: true
  },
  
  // 问题
  question: {
    type: String,
    required: true,
    maxlength: 1000
  },
  
  // 答案
  answer: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  // 问题序号
  questionOrder: {
    type: Number,
    required: true,
    min: 1
  },
  
  // 问题类型/分类
  questionType: {
    type: String,
    enum: ['概念理解', '技术实现', '应用场景', '优缺点分析', '对比分析', '实践经验', '其他'],
    default: '其他'
  },
  
  // 难度等级
  difficulty: {
    type: String,
    enum: ['初级', '中级', '高级'],
    default: '中级'
  },
  
  // 关键词标签
  tags: [{
    type: String,
    maxlength: 50
  }],
  
  // 质量评分 (1-5)
  qualityScore: {
    type: Number,
    max: 5,
    default: 3
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
  timestamps: true,
  versionKey: false
});

// 复合索引优化
interviewSummarizeSchema.index({ summaryId: 1, questionOrder: 1 });
interviewSummarizeSchema.index({ urlHash: 1, questionOrder: 1 });
interviewSummarizeSchema.index({ questionType: 1, difficulty: 1 });

// 全文搜索索引
interviewSummarizeSchema.index(
  { 'question': 'text', 'answer': 'text', 'tags': 'text' },
  { default_language: 'none' }
);

// 中间件：更新时间
interviewSummarizeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 实例方法：获取格式化的问答
interviewSummarizeSchema.methods.getFormattedQA = function() {
  return {
    order: this.questionOrder,
    question: this.question,
    answer: this.answer,
    type: this.questionType,
    difficulty: this.difficulty,
    tags: this.tags,
    score: this.qualityScore
  };
};

// 静态方法：根据summaryId获取所有问答
interviewSummarizeSchema.statics.getBySummaryId = function(summaryId) {
  return this.find({ summaryId })
    .sort({ questionOrder: 1 })
    .lean();
};

// 静态方法：根据urlHash获取所有问答
interviewSummarizeSchema.statics.getByUrlHash = function(urlHash) {
  return this.find({ urlHash })
    .sort({ questionOrder: 1 })
    .lean();
};

// 静态方法：生成markdown格式的问答
interviewSummarizeSchema.statics.generateMarkdown = async function(summaryId) {
  const qaList = await this.getBySummaryId(summaryId);
  
  if (!qaList || qaList.length === 0) {
    return '暂无面试问答内容';
  }
  
  let markdown = '# 面试问答总结\n\n';
  
  qaList.forEach((qa, index) => {
    markdown += `## 问题 ${qa.questionOrder}\n\n`;
    markdown += `**类型**: ${qa.questionType} | **难度**: ${qa.difficulty}\n\n`;
    markdown += `**问题**: ${qa.question}\n\n`;
    markdown += `**答案**: ${qa.answer}\n\n`;
    
    if (qa.tags && qa.tags.length > 0) {
      markdown += `**标签**: ${qa.tags.join(', ')}\n\n`;
    }
    
    markdown += `**质量评分**: ${qa.qualityScore}/5\n\n`;
    markdown += '---\n\n';
  });
  
  return markdown;
};

// 静态方法：删除指定summaryId的所有问答
interviewSummarizeSchema.statics.deleteBySummaryId = function(summaryId) {
  return this.deleteMany({ summaryId });
};

module.exports = mongoose.model('InterviewSummarize', interviewSummarizeSchema);