const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const AIFactory = require('./aiFactory');
const { TEXT_LIMITS } = require('../../constants');

class QAGenerator {
  constructor(aiFactory = null) {
    // 文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: TEXT_LIMITS.CHUNK_SIZE || 3000,
      chunkOverlap: TEXT_LIMITS.CHUNK_OVERLAP || 200,
      separators: ['\n\n', '\n', '。', '！', '？', '.', '!', '?', ' ', '']
    });
    
    this.aiFactory = aiFactory || new AIFactory();
  }

  /**
   * 生成面试问答
   */
  async generateInterviewQA(title, content, options = {}) {
    try {
      const maxQACount = options.maxQACount || 10;
      
      if (content.length <= 4000) {
        // 内容较短，直接生成
        return await this._generateQAForChunk(title, content, 1, 1, { maxQACount });
      } else {
        // 内容较长，分块处理
        return await this._generateQAWithChunks(title, content, options);
      }
    } catch (error) {
      console.error('生成问答失败:', error.message);
      return this.getDefaultQA();
    }
  }

  /**
   * 分块生成问答
   */
  async _generateQAWithChunks(title, content, options = {}) {
    try {
      const maxQACount = options.maxQACount || 10;
      const chunks = await this.textSplitter.splitText(content);
      
      if (chunks.length === 0) {
        return this.getDefaultQA();
      }
      
      const qaPerChunk = Math.max(1, Math.floor(maxQACount / chunks.length));
      let allQAs = [];
      
      for (let i = 0; i < chunks.length && allQAs.length < maxQACount; i++) {
        const remainingQAs = maxQACount - allQAs.length;
        const currentQACount = Math.min(qaPerChunk, remainingQAs);
        
        const chunkQAs = await this._generateQAForChunk(
          title, 
          chunks[i], 
          i + 1, 
          chunks.length, 
          { maxQACount: currentQACount }
        );
        
        allQAs = allQAs.concat(chunkQAs);
      }
      
      // 去重和优化
      allQAs = this._deduplicateQAs(allQAs);
      
      return allQAs.slice(0, maxQACount);
    } catch (error) {
      console.error('分块生成问答失败:', error.message);
      return this.getDefaultQA();
    }
  }

  /**
   * 为单个文本块生成问答
   */
  async _generateQAForChunk(title, content, chunkIndex, totalChunks, options = {}) {
    const maxQACount = options.maxQACount || 5;
    
    const prompt = `请基于以下内容生成${maxQACount}个面试问答，要求：

1. 问题要有深度，能考察理解能力
2. 答案要准确、完整，包含关键信息
3. 问题类型要多样化（概念、应用、分析、评价等）
4. 每个问答都要有相关的技能标签
5. 严格按照JSON格式返回

标题：${title}
内容：${content.substring(0, 2000)}${content.length > 2000 ? '...' : ''}

请返回JSON格式：
{
  "qaList": [
    {
      "question": "问题内容",
      "answer": "答案内容",
      "tags": ["标签1", "标签2"],
      "difficulty": "初级|中级|高级",
      "type": "概念|应用|分析|评价"
    }
  ]
}`;

    try {
      const response = await this.aiFactory.callAPI(prompt);
      return this.parseQAResponse(response);
    } catch (error) {
      console.error(`生成第${chunkIndex}块问答失败:`, error.message);
      return [];
    }
  }

  /**
   * 解析AI返回的问答数据
   */
  parseQAResponse(response) {
    try {
      // 清理响应文本
      let cleanResponse = response.trim();
      
      // 移除可能的markdown代码块标记
      cleanResponse = cleanResponse.replace(/```json\s*|```\s*/g, '');
      
      // 尝试修复常见的JSON格式问题
      cleanResponse = this._fixJsonFormat(cleanResponse);
      
      const parsed = JSON.parse(cleanResponse);
      
      if (parsed.qaList && Array.isArray(parsed.qaList)) {
        return parsed.qaList.map(qa => ({
          question: qa.question || '暂无问题',
          answer: qa.answer || '暂无答案',
          tags: Array.isArray(qa.tags) ? qa.tags : ['通用'],
          difficulty: qa.difficulty || '中级',
          type: qa.type || '概念',
          qualityScore: this._calculateQAQuality(qa)
        }));
      }
      
      return [];
    } catch (error) {
      console.error('解析问答响应失败:', error.message);
      console.error('原始响应:', response);
      return [];
    }
  }

  /**
   * 修复JSON格式问题
   */
  _fixJsonFormat(jsonStr) {
    // 移除多余的逗号
    jsonStr = jsonStr.replace(/,\s*}/g, '}');
    jsonStr = jsonStr.replace(/,\s*]/g, ']');
    
    // 修复未闭合的引号
    jsonStr = jsonStr.replace(/"([^"]*?)\n/g, '"$1\\n');
    
    // 移除控制字符
    jsonStr = jsonStr.replace(/[\x00-\x1F\x7F]/g, '');
    
    return jsonStr;
  }

  /**
   * 计算单个问答的质量分数
   */
  _calculateQAQuality(qa) {
    let score = 3; // 基础分
    
    // 问题质量评估
    if (qa.question && qa.question.length > 10) {
      score += 0.5;
    }
    if (qa.question && qa.question.includes('?') || qa.question.includes('？')) {
      score += 0.3;
    }
    
    // 答案质量评估
    if (qa.answer && qa.answer.length > 50) {
      score += 0.5;
    }
    if (qa.answer && qa.answer.length > 200) {
      score += 0.5;
    }
    
    // 标签质量评估
    if (qa.tags && qa.tags.length > 0) {
      score += 0.2;
    }
    
    return Math.min(5, Math.max(1, Math.round(score * 10) / 10));
  }

  /**
   * 去重问答
   */
  _deduplicateQAs(qaList) {
    const seen = new Set();
    return qaList.filter(qa => {
      const key = qa.question.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * 获取默认问答
   */
  getDefaultQA() {
    return [
      {
        question: '这篇内容的主要观点是什么？',
        answer: '由于内容处理出现问题，暂时无法生成具体的问答内容。建议重新尝试或检查原始内容。',
        tags: ['通用', '理解'],
        difficulty: '初级',
        type: '概念',
        qualityScore: 2
      }
    ];
  }

  /**
   * 生成Markdown格式的问答总结
   */
  generateMarkdownSummary(qaList, maxLength = 1800) {
    if (!qaList || qaList.length === 0) {
      return '暂无问答内容生成。';
    }

    let markdown = '# 面试问答总结\n\n';
    
    qaList.forEach((qa, index) => {
      if (markdown.length > maxLength) return;
      
      markdown += `## 问题 ${index + 1}\n\n`;
      markdown += `**${qa.question}**\n\n`;
      markdown += `**答案**: ${qa.answer}\n\n`;
      
      if (qa.tags && qa.tags.length > 0) {
        markdown += `**标签**: ${qa.tags.join(', ')}\n\n`;
      }
      
      if (qa.difficulty) {
        markdown += `**难度**: ${qa.difficulty}\n\n`;
      }
      
      if (qa.qualityScore) {
        markdown += `**质量评分**: ${qa.qualityScore}/5\n\n`;
      }
      
      markdown += '---\n\n';
    });

    return markdown.length > maxLength ? 
      markdown.substring(0, maxLength) + '...' : 
      markdown;
  }
}

module.exports = QAGenerator;