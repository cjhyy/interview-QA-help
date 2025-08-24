const Summary = require('../models/Summary');
const InterviewSummarize = require('../models/InterviewSummarize');
const WebScraper = require('../utils/webScraper');
const AISummarizer = require('../utils/aiSummarizer');
const { cache } = require('../config/redis');
const { SUMMARY_STATUS, HTTP_STATUS, PAGINATION, CACHE } = require('../constants');

class SummaryService {
  constructor() {
    this.webScraper = new WebScraper();
    this.aiSummarizer = new AISummarizer();
  }

  /**
   * 创建网页内容总结
   */
  async createSummary(url, startTime) {
    // 生成URL哈希
    const urlHash = this.webScraper.generateUrlHash(url);
    
    // 检查缓存
    const cacheKey = `summary:${urlHash}`;
    const cachedResult = await cache.get(cacheKey);
    if (cachedResult) {
      console.log('📋 从缓存返回结果:', url);
      
      // 更新访问次数
      const summary = await Summary.findByUrlHash(urlHash);
      if (summary) {
        await summary.incrementAccess();
      }
      
      return {
        success: true,
        message: '总结已完成（来自缓存）',
        data: cachedResult,
        fromCache: true,
        processingTime: Date.now() - startTime
      };
    }
    
    console.log('🔍 检查数据库中是否已存在:', url);
    // 检查数据库中是否已存在
    let existingSummary = await Summary.findByUrlHash(urlHash);
    
    if (existingSummary) {
      console.log('📄 数据库中已存在，状态:', existingSummary.status);
      
      if (existingSummary.status === 'completed') {
        // 更新访问次数
        await existingSummary.incrementAccess();
        
        // 缓存结果
        const result = {
          id: existingSummary._id,
          url: existingSummary.url,
          title: existingSummary.title,
          qaCount: existingSummary.qaCount,
          keywords: existingSummary.keywords,
          category: existingSummary.category,
          qualityScore: existingSummary.qualityScore,
          createdAt: existingSummary.createdAt
        };
        
        await cache.set(cacheKey, result, 3600); // 缓存1小时
        
        return {
          success: true,
          message: '总结已完成（来自数据库）',
          data: result,
          fromCache: false,
          processingTime: Date.now() - startTime
        };
      } else if (existingSummary.status === 'processing') {
        return {
          success: true,
          message: '正在处理中，请稍后查询结果',
          taskId: existingSummary._id,
          processingTime: Date.now() - startTime
        };
      } else {
        // 如果之前失败了，重新处理
        existingSummary.status = 'processing';
        existingSummary.errorMessage = undefined;
        await existingSummary.save();
      }
    } else {
      // 创建新的总结记录
      existingSummary = new Summary({
        url,
        urlHash,
        status: 'processing'
      });
      await existingSummary.save();
    }
    
    // 异步处理（不阻塞响应）
    this.processUrlAsync(existingSummary._id, url, urlHash);
    
    return {
      success: true,
      message: '正在处理中，请稍后查询结果',
      taskId: existingSummary._id,
      processingTime: Date.now() - startTime
    };
  }

  /**
   * 获取总结状态
   */
  async getSummaryStatus(taskId) {
    const summary = await Summary.findById(taskId);
    
    if (!summary) {
      return {
        success: false,
        error: '任务不存在'
      };
    }
    
    const response = {
      success: true,
      status: summary.status,
      taskId: summary._id
    };
    
    if (summary.status === 'completed') {
      response.data = {
        id: summary._id,
        url: summary.url,
        title: summary.title,
        qaCount: summary.qaCount,
        keywords: summary.keywords,
        category: summary.category,
        qualityScore: summary.qualityScore,
        createdAt: summary.createdAt
      };
    } else if (summary.status === 'failed') {
      response.error = summary.errorMessage;
    }
    
    return response;
  }

  /**
   * 获取总结列表
   */
  async getSummaryList(page, limit, sort) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    let summaries;
    if (sort === 'popular') {
      summaries = await Summary.getPopular(limitNum, skip);
    } else {
      summaries = await Summary.getRecent(limitNum, skip);
    }
    
    return {
      success: true,
      data: summaries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: summaries.length
      }
    };
  }

  /**
   * 搜索总结
   */
  async searchSummaries(query, limit) {
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const summaries = await Summary.search(query, limitNum);
    
    return {
      success: true,
      data: summaries,
      query: query,
      total: summaries.length
    };
  }

  /**
   * 获取问答数据
   */
  async getQAData(summaryId) {
    const summary = await Summary.findById(summaryId);
    if (!summary || summary.status !== 'completed') {
      return {
        success: false,
        error: '总结不存在或未完成'
      };
    }
    
    const qaList = await InterviewSummarize.find({
      summaryId: summaryId
    }).sort({ createdAt: 1 });
    
    return {
      success: true,
      data: qaList
    };
  }

  /**
   * 获取总结详情
   */
  async getSummaryById(summaryId) {
    const summary = await Summary.findById(summaryId);
    if (!summary || summary.status !== 'completed') {
      return {
        success: false,
        error: '总结不存在或未完成'
      };
    }
    
    // 更新访问次数
    await summary.incrementAccess();
    
    return {
      success: true,
      data: {
        id: summary._id,
        url: summary.url,
        title: summary.title,
        qaCount: summary.qaCount,
        keywords: summary.keywords,
        category: summary.category,
        qualityScore: summary.qualityScore,
        language: summary.language,
        accessCount: summary.accessCount,
        createdAt: summary.createdAt,
        processingTime: summary.processingTime
      }
    };
  }

  /**
   * 获取总结的问答列表
   */
  async getSummaryQA(summaryId) {
    const summary = await Summary.findById(summaryId);
    if (!summary || summary.status !== 'completed') {
      return {
        success: false,
        error: '总结不存在或未完成'
      };
    }
    
    const qaList = await InterviewSummarize.find({
      summaryId: summaryId
    }).sort({ createdAt: 1 });
    
    return {
      success: true,
      data: qaList
    };
  }

  /**
   * 异步处理URL总结
   */
  async processUrlAsync(summaryId, url, urlHash) {
    try {
      console.log('🚀 开始异步处理:', url);
      
      // 1. 网页抓取
      const scrapingStartTime = Date.now();
      const scrapingResult = await this.webScraper.scrapeContent(url);
      const scrapingTime = Date.now() - scrapingStartTime;
      
      if (!scrapingResult.success) {
        throw new Error(scrapingResult.error || '网页抓取失败');
      }
      
      console.log('✅ 网页抓取完成，内容长度:', scrapingResult.content.length);
      
      // 2. AI总结
      const summarizationStartTime = Date.now();
      const aiResult = await this.aiSummarizer.generateSummary(
        scrapingResult.title,
        scrapingResult.content,
        summaryId,
        urlHash
      );
      const summarizationTime = Date.now() - summarizationStartTime;
      
      if (!aiResult.success) {
        throw new Error(aiResult.error || 'AI总结失败');
      }
      
      console.log('✅ AI总结完成');
      
      // 3. 更新数据库
      const summary = await Summary.findById(summaryId);
      if (summary) {
        summary.title = scrapingResult.title;
        summary.interviewSummaryIds = aiResult.interviewSummaryIds || [];
        summary.qaCount = aiResult.qaCount || 0;
        summary.keywords = aiResult.keywords || [];
        summary.category = aiResult.category || '其他';
        summary.language = scrapingResult.language;
        summary.qualityScore = aiResult.qualityScore || 0;
        summary.status = aiResult.success ? 'completed' : 'partial';
        summary.processingTime = {
          scraping: scrapingTime,
          summarization: summarizationTime,
          total: scrapingTime + summarizationTime
        };
        summary.aiModel = this.useZhipu ? this.zhipuModel : (process.env.AI_MODEL || 'gpt-3.5-turbo');
        
        await summary.save();
        
        // 缓存结果
        const cacheKey = `summary:${urlHash}`;
        const cacheData = {
          id: summary._id,
          url: summary.url,
          title: summary.title,
          qaCount: summary.qaCount,
          keywords: summary.keywords,
          category: summary.category,
          qualityScore: summary.qualityScore,
          createdAt: summary.createdAt
        };
        
        await cache.set(cacheKey, cacheData, 3600); // 缓存1小时
        
        console.log('✅ 处理完成:', url);
      }
      
    } catch (error) {
      console.error('❌ 处理失败:', url, error.message);
      
      // 更新失败状态
      const summary = await Summary.findById(summaryId);
      if (summary) {
        summary.status = 'failed';
        summary.errorMessage = error.message;
        await summary.save();
      }
    }
  }
}

module.exports = SummaryService;