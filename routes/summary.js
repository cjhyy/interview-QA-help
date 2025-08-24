const express = require('express');
const validator = require('validator');
const Summary = require('../models/Summary');
const InterviewSummarize = require('../models/InterviewSummarize');
const webScraper = require('../utils/scraper');
const aiSummarizer = require('../utils/aiSummarizer');
const { cache } = require('../config/redis');

const router = express.Router();

/**
 * @route POST /api/summary/create
 * @desc 创建网页内容总结
 * @access Public
 */
router.post('/create', async (req, res) => {
  const startTime = Date.now();
  console.log('📝 收到创建请求:', req.body);
  try {
    const { url } = req.body;
    
    // 验证输入
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
    
    // 生成URL哈希
    const urlHash = webScraper.generateUrlHash(url);
    
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
      
      return res.json({
        success: true,
        data: cachedResult,
        fromCache: true,
        processingTime: Date.now() - startTime
      });
    }
    console.log('🔍 检查数据库中是否已存在:', url);
    // 检查数据库中是否已存在
    let existingSummary = await Summary.findByUrlHash(urlHash);
    if (existingSummary && existingSummary.status === 'completed') {
      console.log('💾 从数据库返回结果:', url);
      
      await existingSummary.incrementAccess();
      
      const result = {
        id: existingSummary._id,
        url: existingSummary.url,
        title: existingSummary.title,
        summary: existingSummary.summary,
        keywords: existingSummary.keywords,
        category: existingSummary.category,
        qualityScore: existingSummary.qualityScore,
        createdAt: existingSummary.createdAt
      };
      
      // 缓存结果
      await cache.set(cacheKey, result, 3600); // 缓存1小时
      
      return res.json({
        success: true,
        data: result,
        fromDatabase: true,
        processingTime: Date.now() - startTime
      });
    }
    
    // 创建或更新处理记录
    if (!existingSummary) {
      existingSummary = new Summary({
        url,
        urlHash,
        title: '处理中...',
        originalContent: '',
        summary: '',
        status: 'processing'
      });
    } else {
      existingSummary.status = 'processing';
      existingSummary.errorMessage = undefined;
    }
    
    await existingSummary.save();
    
    // 异步处理（不阻塞响应）
    processUrlAsync(existingSummary._id, url, urlHash);
    
    res.json({
      success: true,
      message: '正在处理中，请稍后查询结果',
      taskId: existingSummary._id,
      processingTime: Date.now() - startTime
    });
    
  } catch (error) {
    console.error('❌ 创建总结失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误',
      processingTime: Date.now() - startTime
    });
  }
});

/**
 * @route GET /api/summary/status/:taskId
 * @desc 查询处理状态
 * @access Public
 */
router.get('/status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: '无效的任务ID'
      });
    }
    
    const summary = await Summary.findById(taskId);
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: '任务不存在'
      });
    }
    
    const response = {
      success: true,
      status: summary.status,
      url: summary.url
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
    
    res.json(response);
    
  } catch (error) {
    console.error('❌ 查询状态失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * @route GET /api/summary/list
 * @desc 获取总结列表
 * @access Public
 */
router.get('/list', async (req, res) => {
  try {
    const { page = 1, limit = 20, type = 'recent' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    
    let summaries;
    
    if (type === 'popular') {
      summaries = await Summary.getPopular(limitNum);
    } else {
      summaries = await Summary.getRecent(limitNum);
    }
    
    res.json({
      success: true,
      data: summaries,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: summaries.length
      }
    });
    
  } catch (error) {
    console.error('❌ 获取列表失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * @route GET /api/summary/search
 * @desc 搜索总结
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词至少需要2个字符'
      });
    }
    
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    
    const summaries = await Summary.search(q.trim(), limitNum);
    
    res.json({
      success: true,
      data: summaries,
      query: q.trim(),
      total: summaries.length
    });
    
  } catch (error) {
    console.error('❌ 搜索失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * @route GET /api/summary/qa/:id
 * @desc 获取问答数据
 * @access Public
 */
router.get('/qa/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少总结ID'
      });
    }

    // 根据summaryId获取问答数据
    const qaList = await InterviewSummarize.getBySummaryId(id);
    
    res.json({
      success: true,
      data: qaList
    });
    
  } catch (error) {
    console.error('❌ 获取问答数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * @route GET /api/summary/:id
 * @desc 获取单个总结详情
 * @access Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: '无效的ID格式'
      });
    }
    
    const summary = await Summary.findById(id);
    if (!summary || summary.status !== 'completed') {
      return res.status(404).json({
        success: false,
        error: '总结不存在或未完成'
      });
    }
    
    await summary.incrementAccess();
    
    // 获取相关的问答数据
    const qaList = await InterviewSummarize.getBySummaryId(id);
    
    res.json({
      success: true,
      data: {
        id: summary._id,
        url: summary.url,
        title: summary.title,
        summary: summary.summary,
        keywords: summary.keywords,
        category: summary.category,
        language: summary.language,
        qualityScore: summary.qualityScore,
        accessCount: summary.accessCount,
        createdAt: summary.createdAt,
        updatedAt: summary.updatedAt,
        qaList: qaList
      }
    });
    
  } catch (error) {
    console.error('❌ 获取详情失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * @route GET /api/summary/:id/qa
 * @desc 获取问答数据的markdown格式
 * @access Public
 */
router.get('/:id/qa', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: '无效的ID格式'
      });
    }
    
    const summary = await Summary.findById(id);
    if (!summary || summary.status !== 'completed') {
      return res.status(404).json({
        success: false,
        error: '总结不存在或未完成'
      });
    }
    
    // 获取问答数据并生成markdown
    const qaList = await InterviewSummarize.getBySummaryId(id);
    const markdownContent = await InterviewSummarize.generateMarkdown(id);
    
    res.json({
      success: true,
      data: {
        id: summary._id,
        title: summary.title,
        url: summary.url,
        qaCount: qaList.length,
        markdown: markdownContent,
        qaList: qaList
      }
    });
    
  } catch (error) {
    console.error('❌ 获取问答数据失败:', error);
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    });
  }
});

/**
 * 异步处理URL总结
 * @param {string} summaryId 
 * @param {string} url 
 * @param {string} urlHash 
 */
async function processUrlAsync(summaryId, url, urlHash) {
  try {
    console.log('🚀 开始处理URL:', url);
    
    // 1. 抓取网页内容
    const scrapingStart = Date.now();
    const scrapingResult = await webScraper.scrapeUrl(url);
    const scrapingTime = Date.now() - scrapingStart;
    
    if (!scrapingResult.success) {
      throw new Error(scrapingResult.error);
    }
    
    console.log('✅ 网页内容', scrapingResult);

    // 2. AI总结和问答生成
    const summarizationStart = Date.now();
    let aiResult;
    let summarizationTime = 0;
    
    try {
      aiResult = await aiSummarizer.generateSummary(
        scrapingResult.title,
        scrapingResult.content,
        summaryId,
        urlHash
      );
      summarizationTime = Date.now() - summarizationStart;

      console.log('✅ AI总结', aiResult);
    } catch (aiError) {
      console.warn('⚠️ AI总结失败，但仍保存原始内容:', aiError.message);
      summarizationTime = Date.now() - summarizationStart;
      aiResult = {
        success: false,
        error: aiError.message,
        summary: '暂无总结（AI服务不可用）',
        keywords: [],
        category: '其他',
        qualityScore: 0,
        aiModel: 'none'
      };
    }
    
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
      summary.aiModel = aiResult.aiModel || 'none';
      if (!aiResult.success) {
        summary.errorMessage = aiResult.error;
      }
      
      await summary.save();
      
      // 4. 缓存结果
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
      
      await cache.set(`summary:${urlHash}`, cacheData, 3600);
      
      console.log('✅ 处理完成:', url);
    }
    
  } catch (error) {
    console.error('❌ 处理失败:', url, error.message);
    
    // 更新失败状态
    try {
      const summary = await Summary.findById(summaryId);
      if (summary) {
        summary.status = 'failed';
        summary.errorMessage = error.message;
        await summary.save();
      }
    } catch (updateError) {
      console.error('❌ 更新失败状态出错:', updateError.message);
    }
  }
}

module.exports = router;