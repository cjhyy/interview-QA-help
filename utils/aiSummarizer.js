const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const axios = require('axios');
const AIFactory = require('./ai/aiFactory');
const QAGenerator = require('./ai/qaGenerator');
const { AI_CONFIG, TEXT_LIMITS } = require('../constants');

class AISummarizer {
  constructor() {
    // 文本分割器
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: TEXT_LIMITS?.CHUNK_SIZE || 3000,
      chunkOverlap: TEXT_LIMITS?.CHUNK_OVERLAP || 200,
      separators: ['\n\n', '\n', '。', '！', '？', '.', '!', '?', ' ', '']
    });
    
    this.aiFactory = new AIFactory();
    this.qaGenerator = new QAGenerator(this.aiFactory);
    
    console.log('✅ AISummarizer初始化成功');




  }





  /**
   * 检查AI服务是否可用
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    try {
      if (this.useZhipu) {
        if (!process.env.ZHIPU_API_KEY) {
          console.warn('⚠️ 未配置ZHIPU_API_KEY，AI总结功能不可用');
          return false;
        }
      } else {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
          console.warn('⚠️ 未配置有效的OPENAI_API_KEY，AI总结功能不可用');
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('❌ AI服务检查失败:', error.message);
      return false;
    }
  }

  /**
   * 生成面试问答
   * @param {string} title 
   * @param {string} content 
   * @param {Object} options - 配置选项
   * @param {Function} options.onProgress - 进度回调
   * @returns {Promise<Array>}
   */
  async generateInterviewQA(title, content, options = {}) {
    try {
      if (this.useZhipu) {
        // 如果内容较长，使用分块处理
        if (content.length > 4000) {
          return await this._generateQAWithChunks(title, content, options);
        }
        
        // 限制内容长度，避免提示词过长
        const maxContentLength = Math.min(content.length, 3000);
        const truncatedContent = content.substring(0, maxContentLength);
        
        // 使用智谱AI生成面试问答
        const prompt = `根据内容生成5-8个面试问答，JSON格式返回：

标题：${title}
内容：${truncatedContent}

要求：
1. 涵盖核心知识点
2. 类型：概念理解/技术实现/应用场景/优缺点分析/对比分析/实践经验
3. 难度：初级/中级/高级
4. 答案完整详细准确

JSON格式：
[
  {
    "question": "问题",
    "answer": "答案",
    "type": "类型",
    "difficulty": "难度",
    "tags": ["标签"],
    "score": 4
  }
]`;
        
        const result = await this.callZhipuAI(prompt, { maxTokens: 3000 });
        console.log('智谱AI原始响应长度:',result, result.length);
        return this.parseQAResponse(result);
      } else {
        // 使用OpenAI生成面试问答
//         const prompt = `Based on the following web content, generate 5-10 interview questions and answers.

// Title: ${title}
// Content: ${content.substring(0, 4000)}

// Return as JSON array with format:
// [{"question": "...", "answer": "...", "type": "...", "difficulty": "...", "tags": [...], "score": 4}]`;
        
//         const chain = new LLMChain({
//           llm: this.model,

//         });
        
//         const result = await chain.call({});
//         return this.parseQAResponse(result.text);
//       }
      }
    } catch (error) {
      console.error('❌ 生成面试问答失败:', error.message);
      throw new Error(`AI问答生成失败: ${error.message}`);
    }
  }

  /**
   * 分块生成问答（处理长内容）
   * @param {string} title 
   * @param {string} content 
   * @param {Object} options 
   * @returns {Promise<Array>}
   */
  async _generateQAWithChunks(title, content, options = {}) {
    try {
      // 将内容分成多个块，除第一个块外保留前后200字符上下文
      const chunkSize = 2000;
      const overlapSize = 200; // 重叠字符数
      const chunks = [];
      
      for (let i = 0; i < content.length; i += chunkSize) {
        let start = i;
        let end = Math.min(i + chunkSize, content.length);
        
        // 除了第一个块，保留前面200个字符作为上下文
        if (i > 0) {
          start = Math.max(0, i - overlapSize);
        }
        
        // 除了最后一个块，保留后面200个字符作为上下文
        if (end < content.length) {
          end = Math.min(content.length, i + chunkSize + overlapSize);
        }
        
        chunks.push(content.substring(start, end));
        
        // 如果已经到达内容末尾，跳出循环
        if (end >= content.length) {
          break;
        }
      }
      
      console.log(`📝 内容分为 ${chunks.length} 个块进行处理，每块包含上下文重叠`);
      
      const allQAs = [];
      const promises = [];
      
      // 并行处理所有块
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkTitle = `${title} (第${i + 1}部分)`;
        
        const promise = this._generateQAForChunk(chunkTitle, chunk, i + 1, chunks.length, options)
          .then(qaList => {
            if (options.onProgress) {
              options.onProgress(`完成第${i + 1}/${chunks.length}块处理`, qaList);
            }
            return qaList;
          })
          .catch(error => {
            console.error(`块${i + 1}处理失败:`, error.message);
            return []; // 返回空数组，不影响其他块的处理
          });
        
        promises.push(promise);
      }
      
      // 等待所有块处理完成
      const results = await Promise.all(promises);
      
      // 合并所有结果
      for (const qaList of results) {
        allQAs.push(...qaList);
      }
      
      // 去重和优化
      const uniqueQAs = this._deduplicateQAs(allQAs);
      
      console.log(`✅ 分块处理完成，共生成 ${uniqueQAs.length} 个问答`);
      console.log('uniqueQAs',uniqueQAs);
      return uniqueQAs; // 不限制返回问答数量
      
    } catch (error) {
      console.error('❌ 分块处理失败:', error.message);
      throw error;
    }
  }
  
  /**
   * 为单个块生成问答
   * @param {string} title 
   * @param {string} content 
   * @param {number} chunkIndex 
   * @param {number} totalChunks 
   * @param {Object} options 
   * @returns {Promise<Array>}
   */
  async _generateQAForChunk(title, content, chunkIndex, totalChunks, options = {}) {
    const prompt = `根据内容生成3-5个面试问答，JSON格式返回：

标题：${title}
内容：${content}

要求：
1. 针对此部分内容的核心知识点
2. 类型：概念理解/技术实现/应用场景/优缺点分析
3. 难度：初级/中级/高级
4. 答案完整准确

JSON格式：
[{"question":"问题","answer":"答案","type":"类型","difficulty":"难度","tags":["标签"],"score":4}]`;
    
    const result = await this.callZhipuAI(prompt, { maxTokens: 4000 });
    console.log(result,'result')
    return this.parseQAResponse(result);
  }
  
  /**
   * 去重问答
   * @param {Array} qaList 
   * @returns {Array}
   */
  _deduplicateQAs(qaList) {
    const seen = new Set();
    const unique = [];
    
    for (const qa of qaList) {
      const key = qa.question.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(qa);
      }
    }
    
    return unique;
  }

  /**
   * 解析问答响应
   * @param {string} response 
   * @returns {Array}
   */
  parseQAResponse(response) {
    try {
      // 尝试直接解析JSON
      let jsonStr = response.trim();
      console.log(jsonStr,'原始响应长度:', jsonStr.length);
      
      // 移除可能的markdown代码块标记
      jsonStr = jsonStr.replace(/```json\s*/, '').replace(/```\s*$/, '');
      
      console.log(jsonStr,'jsonStr');

      // 检查是否被截断（通常以不完整的JSON结尾）
      if (!jsonStr.endsWith(']') && !jsonStr.endsWith('}')) {
        console.warn('⚠️ 检测到响应可能被截断，尝试修复...');
        // 尝试找到最后一个完整的对象
        const lastCompleteIndex = jsonStr.lastIndexOf('}');
        if (lastCompleteIndex > 0) {
          jsonStr = jsonStr.substring(0, lastCompleteIndex + 1) + ']';
        }
      }
      
      // 尝试提取JSON数组
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      console.log(jsonStr,'jsonStr');
      
      const qaList = JSON.parse(jsonStr);
      
      // 验证和标准化数据
      const validQAs = qaList.filter(qa => qa.question && qa.answer)
        .map((qa, index) => ({
          question: qa.question || `问题 ${index + 1}`,
          answer: qa.answer || '暂无答案',
          type: qa.type || '其他',
          difficulty: qa.difficulty || '中级',
          tags: Array.isArray(qa.tags) ? qa.tags : [],
          score: qa.score || 3
        })).slice(0, 8); // 最多8个问答
      
      console.log(`✅ 成功解析 ${validQAs.length} 个问答`);
      return validQAs.length > 0 ? validQAs : this.getDefaultQA();
      
    } catch (error) {
      console.error('❌ 解析问答响应失败:', error.message);
      console.log('失败的响应内容:', response.substring(0, 500));
      return this.getDefaultQA();
    }
  }
  
  /**
   * 修复JSON格式问题
   * @param {string} jsonStr 
   * @returns {string}
   */
  _fixJsonFormat(jsonStr) {
    try {
      // 修复tags数组中缺少引号的问题
      // 例如: "tags": [技术, 前端] -> "tags": ["技术", "前端"]
      jsonStr = jsonStr.replace(/"tags":\s*\[([^\]]+)\]/g, (match, content) => {
        // 分割标签并添加引号
        const tags = content.split(',').map(tag => {
          const trimmed = tag.trim();
          // 如果已经有引号，保持不变
          if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
            return trimmed;
          }
          // 否则添加引号
          return `"${trimmed}"`;
        });
        return `"tags": [${tags.join(', ')}]`;
      });
      
      // 修复其他可能的格式问题
      // 移除多余的逗号
      jsonStr = jsonStr.replace(/,\s*([}\]])/g, '$1');
      
      // 确保字符串值都有引号
      jsonStr = jsonStr.replace(/:\s*([^"\[\{][^,}\]]*)/g, (match, value) => {
        const trimmed = value.trim();
        // 如果是数字或布尔值，保持不变
        if (/^\d+$/.test(trimmed) || trimmed === 'true' || trimmed === 'false') {
          return `: ${trimmed}`;
        }
        // 否则添加引号
        return `: "${trimmed}"`;
      });
      
      return jsonStr;
    } catch (error) {
      console.warn('JSON格式修复失败:', error.message);
      return jsonStr;
    }
  }

  /**
   * 获取默认问答
   * @returns {Array}
   */
  getDefaultQA() {
    return [{
      question: '请简述该内容的主要观点？',
      answer: '根据内容分析，主要观点包括相关的核心概念和实践要点。',
      type: '概念理解',
      difficulty: '中级',
      tags: ['基础概念'],
      score: 3
    }];
  }

  /**
   * 生成基于问答的Markdown总结
   * @param {Array} qaList 
   * @param {number} maxLength - 最大长度限制，默认1800字符
   * @returns {string}
   */
  generateMarkdownSummary(qaList, maxLength = 1800) {
    if (!qaList || qaList.length === 0) {
      return '## 面试问答总结\n\n暂无问答内容。';
    }

    let markdown = '## 面试问答总结\n\n';
    
    // 按难度分组
    const groupedByDifficulty = {
      '初级': qaList.filter(qa => qa.difficulty === '初级'),
      '中级': qaList.filter(qa => qa.difficulty === '中级'),
      '高级': qaList.filter(qa => qa.difficulty === '高级')
    };

    // 按难度顺序生成markdown，同时控制长度
    ['初级', '中级', '高级'].forEach(difficulty => {
      const qas = groupedByDifficulty[difficulty];
      if (qas && qas.length > 0) {
        const sectionHeader = `### ${difficulty}问题\n\n`;
        
        // 检查是否还有空间添加这个部分
        if (markdown.length + sectionHeader.length > maxLength) {
          return;
        }
        
        markdown += sectionHeader;
        
        qas.forEach((qa, index) => {
          // 截断过长的答案
          const truncatedAnswer = qa.answer.length > 200 ? 
            qa.answer.substring(0, 200) + '...' : qa.answer;
          
          const qaSection = `#### ${index + 1}. ${qa.question}\n\n` +
            `**类型**: ${qa.type}\n\n` +
            (qa.tags && qa.tags.length > 0 ? `**标签**: ${qa.tags.join(', ')}\n\n` : '') +
            `**答案**: ${truncatedAnswer}\n\n` +
            `---\n\n`;
          
          // 检查添加这个问答是否会超出长度限制
          if (markdown.length + qaSection.length > maxLength) {
            markdown += `\n*注：由于长度限制，部分问答已省略...*\n`;
            return;
          }
          
          markdown += qaSection;
        });
      }
    });

    // 最终长度检查和截断
    if (markdown.length > maxLength) {
      markdown = markdown.substring(0, maxLength - 50) + '\n\n*内容已截断...*';
    }

    return markdown;
  }

  /**
   * 生成AI总结
   * @param {string} title 
   * @param {string} content 
   * @param {string} summaryId - Summary记录的ID
   * @param {string} urlHash - URL哈希值
   * @returns {Object}
   */
  async generateSummary(title, content, summaryId, urlHash) {
    try {
      console.log('🤖 开始生成AI总结...');
      
      // 使用QA生成器生成问答
      const result = await this.qaGenerator.generateQA(content, { title, summaryId, urlHash });
      
      console.log(`✅ 总结完成，生成 ${result.qaCount} 个问答，质量分数: ${result.qualityScore}`);
      return result;
      
    } catch (error) {
      console.error('❌ 生成AI总结失败:', error.message);
      return {
        success: false,
        error: error.message,
        summary: `生成总结时出现错误: ${error.message}`,
        qaList: [],
        interviewSummaryIds: [],
        qaCount: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
    * 存储问答到数据库
    * @param {Array} qaList 
    * @param {string} summaryId - Summary记录的ID
    * @param {string} urlHash - URL哈希值
    * @returns {Promise<Array>} 返回保存的问答ID数组
    */
   async saveQAToDatabase(qaList, summaryId, urlHash) {
     const InterviewSummarize = require('../models/InterviewSummarize');
     
     try {
       const savedIds = [];
       
       for (let i = 0; i < qaList.length; i++) {
         const qa = qaList[i];
         const interviewQA = new InterviewSummarize({
           summaryId: summaryId,
           urlHash: urlHash,
           question: qa.question,
           answer: qa.answer,
           questionOrder: i + 1,
           questionType: qa.type || 'general',
           difficulty: qa.difficulty || 'medium',
           tags: qa.tags || [],
           qualityScore: qa.score || 3
         });
         
         const saved = await interviewQA.save();
         savedIds.push(saved._id);
       }
       
       console.log(`💾 已保存 ${savedIds.length} 个问答到数据库`);
       return savedIds;
     } catch (error) {
       console.error('❌ 存储问答到数据库失败:', error);
       throw error;
     }
   }

   /**
    * 生成markdown格式的总结
    * @param {Array} qaList 
    * @returns {string}
    */
   generateMarkdownSummary(qaList) {
     let markdown = '# 面试问答总结\n\n';
     
     qaList.forEach((qa, index) => {
       markdown += `## 问题 ${index + 1}\n\n`;
       markdown += `**${qa.question}**\n\n`;
       markdown += `${qa.answer}\n\n`;
       markdown += '---\n\n';
     });
     
     return markdown;
   }

  /**
   * 生成传统内容总结（保留原方法用于兼容）
   * @param {string} title 
   * @param {string} content 
   * @returns {Promise<string>}
   */
  async generateContentSummary(title, content) {
    try {
      if (this.useZhipu) {
        // 使用智谱AI
        const prompt = `请对以下网页内容进行智能总结，要求：

1. 提取核心观点和主要信息
2. 保持逻辑清晰，结构合理
3. 总结长度控制在200-500字之间
4. 使用简洁明了的语言
5. 如果是技术文章，请突出技术要点
6. 如果是新闻资讯，请突出关键事实

网页标题：${title}

网页内容：
${content.substring(0, 3000)}

请提供高质量的总结：`;
        
        return await this.callZhipuAI(prompt);
      } else {
        // 使用OpenAI
        // 如果内容太长，先进行分块处理
        if (content.length > 3000) {
          const chunks = await this.textSplitter.splitText(content);
          
          // 对每个块生成摘要
          const chunkSummaries = [];
          for (const chunk of chunks.slice(0, 3)) { // 最多处理3个块
            const chain = new LLMChain({
              llm: this.model,
              prompt: this.summaryPrompt
            });
            
            const result = await chain.call({
              title: title,
              content: chunk
            });
            
            chunkSummaries.push(result.text.trim());
          }
          
          // 合并块摘要
          const combinedSummary = chunkSummaries.join('\n\n');
          
          // 如果合并后的摘要还是太长，再次总结
          if (combinedSummary.length > 800) {
            const finalChain = new LLMChain({
              llm: this.model,
              prompt: this.summaryPrompt
            });
            
            const finalResult = await finalChain.call({
              title: title,
              content: combinedSummary
            });
            
            return finalResult.text.trim();
          }
          
          return combinedSummary;
        } else {
          // 内容不长，直接总结
          const chain = new LLMChain({
            llm: this.model,
            prompt: this.summaryPrompt
          });
          
          const result = await chain.call({
            title: title,
            content: content
          });
          
          return result.text.trim();
        }
      }
    } catch (error) {
      console.error('❌ 生成总结失败:', error.message);
      throw new Error(`AI总结失败: ${error.message}`);
    }
  }

  /**
   * 提取关键词
   * @param {string} content 
   * @returns {Promise<Array>}
   */
  async extractKeywords(content) {
    try {
      if (this.useZhipu) {
        // 使用智谱AI
        const prompt = `请从以下内容中提取5-8个最重要的关键词，要求：

1. 关键词应该能够代表内容的核心主题
2. 优先选择专业术语和重要概念
3. 用逗号分隔关键词
4. 只返回关键词，不要其他解释

内容：
${content.substring(0, 2000)}

关键词：`;
        
        const result = await this.callZhipuAI(prompt);
        
        // 解析关键词
        const keywords = result
          .split(/[,，、\n]/) // 支持多种分隔符
          .map(keyword => keyword.trim())
          .filter(keyword => keyword.length > 0 && keyword.length < 20)
          .slice(0, 8); // 最多8个关键词
        
        return keywords;
      } else {
        // 使用OpenAI
        const chain = new LLMChain({
          llm: this.model,
          prompt: this.keywordsPrompt
        });
        
        const result = await chain.call({
          content: content.substring(0, 2000) // 限制内容长度
        });
        
        const keywords = result.text.trim()
          .split(/[,，、]/)
          .map(keyword => keyword.trim())
          .filter(keyword => keyword.length > 0 && keyword.length < 20)
          .slice(0, 8); // 最多8个关键词
        
        return keywords;
      }
    } catch (error) {
      console.error('❌ 提取关键词失败:', error.message);
      return []; // 返回空数组而不是抛出错误
    }
  }

  /**
   * 内容分类
   * @param {string} title 
   * @param {string} summary 
   * @returns {Promise<string>}
   */
  async categorizeContent(title, summary) {
    try {
      const validCategories = ['技术', '新闻', '教育', '娱乐', '商业', '科学', '其他'];
      
      if (this.useZhipu) {
        // 使用智谱AI
        const prompt = `请将以下内容分类到最合适的类别中，只能选择以下类别之一：
${validCategories.join('、')}

内容标题：${title}
内容摘要：${summary.substring(0, 500)}

请只返回类别名称，不要其他内容：`;
        
        const result = await this.callZhipuAI(prompt);
        const category = result.trim();
        
        // 验证分类结果
        return validCategories.includes(category) ? category : '其他';
      } else {
        // 使用OpenAI
        const chain = new LLMChain({
          llm: this.model,
          prompt: this.categoryPrompt
        });
        
        const result = await chain.call({
          title: title,
          summary: summary.substring(0, 500)
        });
        
        const category = result.text.trim();
        
        // 验证分类结果
        return validCategories.includes(category) ? category : '其他';
      }
    } catch (error) {
      console.error('❌ 内容分类失败:', error.message);
      return '其他'; // 返回默认分类
    }
  }

  /**
   * 评估问答质量
   * @param {Array} qaList 问答列表
   * @returns {number} 1-5分
   */
  evaluateQuality(qaList) {
    try {
      let score = 3; // 基础分
      
      if (!qaList || !Array.isArray(qaList)) {
        return 2;
      }
      
      // 问答数量评估
      const qaCount = qaList.length;
      if (qaCount >= 5 && qaCount <= 15) {
        score += 1;
      } else if (qaCount >= 3 && qaCount < 5) {
        score += 0.5;
      } else if (qaCount < 3) {
        score -= 1;
      } else if (qaCount > 20) {
        score -= 0.5;
      }
      
      // 问答内容质量评估
      let totalAnswerLength = 0;
      let validQACount = 0;
      
      qaList.forEach(qa => {
        if (qa.question && qa.answer) {
          validQACount++;
          totalAnswerLength += qa.answer.length;
          
          // 答案长度合理性
          if (qa.answer.length >= 50 && qa.answer.length <= 500) {
            score += 0.1;
          }
        }
      });
      
      // 有效问答比例
      const validRatio = validQACount / qaCount;
      if (validRatio >= 0.9) {
        score += 0.5;
      } else if (validRatio < 0.7) {
        score -= 0.5;
      }
      
      // 确保分数在1-5范围内
      return Math.max(1, Math.min(5, Math.round(score * 2) / 2));
    } catch (error) {
      console.error('❌ 评估质量失败:', error.message);
      return 3; // 返回默认分数
    }
  }

  /**
   * 完整的内容处理流程
   * @param {string} title 
   * @param {string} content 
   * @returns {Promise<object>}
   */
  async processContent(title, content) {
    const startTime = Date.now();
    
    try {
      // 检查服务可用性
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        throw new Error('AI服务不可用');
      }
      
      // 生成面试问答
      const qaList = await this.generateInterviewQA(title, content);
      
      // 生成基于问答的markdown总结
      const summary = this.generateMarkdownSummary(qaList);
      
      // 提取关键词
      const keywords = await this.extractKeywords(content);
      
      // 内容分类
      const category = await this.categorizeContent(title, summary);
      
      // 评估质量
      const qualityScore = this.evaluateQuality(content, summary);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        summary,
        keywords,
        category,
        qualityScore,
        processingTime,
        aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo',
        qaList // 返回问答列表用于保存到数据库
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        error: error.message,
        processingTime,
        aiModel: process.env.AI_MODEL || 'gpt-3.5-turbo'
      };
    }
  }
}

module.exports = AISummarizer;