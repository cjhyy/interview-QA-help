const validator = require('validator');
const SummaryService = require('../services/summaryService');
const { HTTP_STATUS } = require('../constants');

const summaryService = new SummaryService();

/**
 * 创建网页内容总结
 */
const createSummary = async (req, res) => {
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
    
    const result = await summaryService.createSummary(url, startTime);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 创建总结失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

/**
 * 查询总结状态
 */
const getSummaryStatus = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: '缺少任务ID'
      });
    }
    
    const result = await summaryService.getSummaryStatus(taskId);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 查询状态失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

/**
 * 获取总结列表
 */
const getSummaryList = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'recent' } = req.query;
    const result = await summaryService.getSummaryList(page, limit, sort);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

/**
 * 搜索总结
 */
const searchSummaries = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词至少需要2个字符'
      });
    }
    
    const result = await summaryService.searchSummaries(q.trim(), limit);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 搜索失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

/**
 * 获取问答数据
 */
const getQAData = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少总结ID'
      });
    }
    
    const result = await summaryService.getQAData(id);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取问答数据失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

/**
 * 获取总结详情
 */
const getSummaryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少总结ID'
      });
    }
    
    const result = await summaryService.getSummaryById(id);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取总结详情失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

/**
 * 获取总结的问答列表
 */
const getSummaryQA = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少总结ID'
      });
    }
    
    const result = await summaryService.getSummaryQA(id);
    res.json(result);
    
  } catch (error) {
    console.error('❌ 获取问答列表失败:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: '服务器内部错误'
    });
  }
};

module.exports = {
  createSummary,
  getSummaryStatus,
  getSummaryList,
  searchSummaries,
  getQAData,
  getSummaryById,
  getSummaryQA
};