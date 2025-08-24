const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');

// 后续可以换成puppeteer  支持js渲染完全

class WebScraper {
  constructor() {
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
  }

  /**
   * 生成URL的MD5哈希
   * @param {string} url 
   * @returns {string}
   */
  generateUrlHash(url) {
    return crypto.createHash('md5').update(url.toLowerCase().trim()).digest('hex');
  }

  /**
   * 获取随机User-Agent
   * @returns {string}
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * 验证URL格式
   * @param {string} url 
   * @returns {boolean}
   */
  isValidUrl(url) {
    try {
      new URL(url);
      return /^https?:\/\/.+/.test(url);
    } catch {
      return false;
    }
  }

  /**
   * 清理和提取文本内容
   * @param {string} html 
   * @returns {object}
   */
  extractContent(html) {
    const $ = cheerio.load(html);
    
    // 移除不需要的元素
    $('script, style, nav, header, footer, aside, .advertisement, .ads, .sidebar').remove();
    
    // 提取标题
    let title = $('title').text().trim() || 
                $('h1').first().text().trim() || 
                $('meta[property="og:title"]').attr('content') || 
                '无标题';
    
    // 提取主要内容
    let content = '';
    
    // 尝试多种内容选择器
    const contentSelectors = [
      'article',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      'main',
      '.main-content',
      '#content',
      '.post-body',
      '.article-body'
    ];
    
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        if (content.length > 200) { // 确保内容足够长
          break;
        }
      }
    }
    
    // 如果没有找到主要内容，提取所有段落
    if (!content || content.length < 200) {
      content = $('p').map((i, el) => $(el).text().trim()).get().join('\n');
    }
    
    // 如果还是没有内容，提取body中的所有文本
    if (!content || content.length < 100) {
      content = $('body').text().trim();
    }
    
    // 清理内容
    content = this.cleanText(content);
    
    // 提取关键词（简单实现）
    const keywords = this.extractKeywords(content);
    
    // 检测语言
    const language = this.detectLanguage(content);
    
    return {
      title: title.substring(0, 500),
      content: content, // 限制内容长度
      keywords,
      language,
      wordCount: content.split(/\s+/).length
    };
  }

  /**
   * 清理文本内容
   * @param {string} text 
   * @returns {string}
   */
  cleanText(text) {
    return text
      .replace(/\s+/g, ' ') // 合并多个空白字符
      .replace(/\n\s*\n/g, '\n') // 合并多个换行
      .replace(/[^\u4e00-\u9fa5\w\s.,!?;:()\[\]{}"'-]/g, '') // 保留中文、英文、数字和基本标点
      .trim();
  }

  /**
   * 提取关键词（简单实现）
   * @param {string} content 
   * @returns {Array}
   */
  extractKeywords(content) {
    // 简单的关键词提取：找出出现频率较高的词
    const words = content.toLowerCase()
      .replace(/[^\u4e00-\u9fa5\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // 过滤短词
    
    const wordCount = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // 排序并取前10个
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * 检测文本语言
   * @param {string} content 
   * @returns {string}
   */
  detectLanguage(content) {
    const chineseChars = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (content.match(/[a-zA-Z]/g) || []).length;
    const totalChars = content.length;
    
    if (chineseChars / totalChars > 0.3) {
      return 'zh';
    } else if (englishChars / totalChars > 0.5) {
      return 'en';
    } else {
      return 'other';
    }
  }

  /**
   * 抓取网页内容
   * @param {string} url 
   * @returns {Promise<object>}
   */
  async scrapeUrl(url) {
    const startTime = Date.now();
    
    try {
      // 验证URL
      if (!this.isValidUrl(url)) {
        throw new Error('无效的URL格式');
      }

      // 配置请求
      const config = {
        method: 'GET',
        url: url,
        timeout: 30000, // 30秒超时
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      };

      // 发送请求
      const response = await axios(config);
      
      // 检查响应
      if (!response.data) {
        throw new Error('响应内容为空');
      }

      // 提取内容
      const extractedData = this.extractContent(response.data);
      console.log('提取内容:', extractedData,extractedData.content.length);
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        url: url,
        urlHash: this.generateUrlHash(url),
        title: extractedData.title,
        content: extractedData.content,
        keywords: extractedData.keywords,
        language: extractedData.language,
        wordCount: extractedData.wordCount,
        processingTime,
        statusCode: response.status,
        contentType: response.headers['content-type'] || 'unknown'
      };
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      let errorMessage = '抓取失败';
      
      if (error.code === 'ENOTFOUND') {
        errorMessage = '域名解析失败，请检查URL是否正确';
      } else if (error.code === 'ECONNREFUSED') {
        errorMessage = '连接被拒绝，服务器可能不可用';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = '请求超时，请稍后重试';
      } else if (error.response) {
        errorMessage = `HTTP错误: ${error.response.status} ${error.response.statusText}`;
      } else {
        errorMessage = error.message || '未知错误';
      }
      
      return {
        success: false,
        url: url,
        urlHash: this.generateUrlHash(url),
        error: errorMessage,
        processingTime,
        statusCode: error.response?.status || null
      };
    }
  }
}

module.exports = WebScraper;