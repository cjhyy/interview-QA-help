const express = require('express');
const summaryController = require('../controllers/summaryController');
const { validateUrl, validateId, validateSearch, validatePagination } = require('../middleware/validation');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @route POST /api/summary/create
 * @desc 创建网页内容总结
 * @access Public
 */
router.post('/create', validateUrl, asyncHandler(summaryController.createSummary));

/**
 * @route GET /api/summary/status/:taskId
 * @desc 查询处理状态
 * @access Public
 */
router.get('/status/:taskId', validateId('taskId'), asyncHandler(summaryController.getSummaryStatus));

/**
 * @route GET /api/summary/list
 * @desc 获取总结列表
 * @access Public
 */
router.get('/list', validatePagination, asyncHandler(summaryController.getSummaryList));

/**
 * @route GET /api/summary/search
 * @desc 搜索总结
 * @access Public
 */
router.get('/search', validateSearch, asyncHandler(summaryController.searchSummaries));

/**
 * @route GET /api/summary/qa/:id
 * @desc 获取问答数据
 * @access Public
 */
router.get('/qa/:id', validateId('id'), asyncHandler(summaryController.getQAData));

/**
 * @route GET /api/summary/:id
 * @desc 获取单个总结详情
 * @access Public
 */
router.get('/:id', validateId('id'), asyncHandler(summaryController.getSummaryById));

/**
 * @route GET /api/summary/:id/qa
 * @desc 获取问答数据的markdown格式
 * @access Public
 */
router.get('/:id/qa', validateId('id'), asyncHandler(summaryController.getQAMarkdown));

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