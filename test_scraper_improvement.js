const WebScraper = require('./utils/scraper');

/**
 * 测试改进后的网页内容提取功能
 */
async function testScraperImprovement() {
  const scraper = new WebScraper();
  
  // 测试URL列表 - 包含不同类型的网站
  const testUrls = [
    'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Introduction',
    'https://www.runoob.com/js/js-intro.html',
    'https://juejin.cn/post/6844903569087266823',
    'https://www.zhihu.com/question/19637373',
    'https://blog.csdn.net/weixin_44799217/article/details/120587234'
  ];
  
  console.log('开始测试改进后的网页内容提取功能...');
  console.log('=' * 60);
  
  for (let i = 0; i < testUrls.length; i++) {
    const url = testUrls[i];
    console.log(`\n测试 ${i + 1}/${testUrls.length}: ${url}`);
    console.log('-' * 50);
    
    try {
      const result = await scraper.scrapeUrl(url);
      
      if (result.success) {
        console.log(`✅ 成功提取内容`);
        console.log(`标题: ${result.data.title}`);
        console.log(`内容长度: ${result.data.content.length} 字符`);
        console.log(`字数统计: ${result.data.wordCount} 词`);
        console.log(`检测语言: ${result.data.language}`);
        console.log(`关键词: ${result.data.keywords.slice(0, 5).join(', ')}`);
        
        // 显示内容预览（前200字符）
        const preview = result.data.content.substring(0, 200).replace(/\n/g, ' ');
        console.log(`内容预览: ${preview}...`);
        
        // 内容质量评估
        const quality = assessContentQuality(result.data.content);
        console.log(`内容质量评分: ${quality.score}/100`);
        console.log(`评估详情: ${quality.details}`);
        
      } else {
        console.log(`❌ 提取失败: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`❌ 发生错误: ${error.message}`);
    }
    
    // 添加延迟避免请求过于频繁
    if (i < testUrls.length - 1) {
      console.log('等待 2 秒...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n测试完成！');
}

/**
 * 评估内容质量
 * @param {string} content - 内容文本
 * @returns {object} 质量评估结果
 */
function assessContentQuality(content) {
  let score = 0;
  const details = [];
  
  // 内容长度评估
  if (content.length > 1000) {
    score += 30;
    details.push('内容长度充足');
  } else if (content.length > 500) {
    score += 20;
    details.push('内容长度适中');
  } else {
    score += 10;
    details.push('内容长度较短');
  }
  
  // 段落结构评估
  const paragraphs = content.split('\n').filter(p => p.trim().length > 20);
  if (paragraphs.length > 5) {
    score += 25;
    details.push('段落结构良好');
  } else if (paragraphs.length > 2) {
    score += 15;
    details.push('段落结构一般');
  } else {
    score += 5;
    details.push('段落结构较差');
  }
  
  // 信息密度评估
  const sentences = content.split(/[.!?。！？]/).filter(s => s.trim().length > 10);
  if (sentences.length > 10) {
    score += 25;
    details.push('信息密度高');
  } else if (sentences.length > 5) {
    score += 15;
    details.push('信息密度中等');
  } else {
    score += 5;
    details.push('信息密度低');
  }
  
  // 内容完整性评估
  const hasChineseContent = /[\u4e00-\u9fa5]/.test(content);
  const hasEnglishContent = /[a-zA-Z]/.test(content);
  if (hasChineseContent || hasEnglishContent) {
    score += 20;
    details.push('包含有效文本内容');
  }
  
  return {
    score: Math.min(score, 100),
    details: details.join(', ')
  };
}

/**
 * 比较改进前后的效果
 */
async function compareBeforeAfter() {
  console.log('\n开始对比测试...');
  console.log('=' * 60);
  
  const testUrl = 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Guide/Introduction';
  const scraper = new WebScraper();
  
  try {
    const result = await scraper.scrapeUrl(testUrl);
    
    if (result.success) {
      console.log('改进后的提取结果:');
      console.log(`- 内容长度: ${result.data.content.length} 字符`);
      console.log(`- 段落数量: ${result.data.content.split('\n').filter(p => p.trim().length > 20).length}`);
      console.log(`- 字数统计: ${result.data.wordCount}`);
      
      // 检查是否包含关键信息
      const hasIntroduction = result.data.content.includes('JavaScript') || result.data.content.includes('介绍');
      const hasCodeExamples = result.data.content.includes('function') || result.data.content.includes('var') || result.data.content.includes('let');
      const hasStructuredContent = result.data.content.split('\n').length > 10;
      
      console.log('\n内容质量检查:');
      console.log(`- 包含JavaScript相关内容: ${hasIntroduction ? '✅' : '❌'}`);
      console.log(`- 包含代码示例: ${hasCodeExamples ? '✅' : '❌'}`);
      console.log(`- 内容结构化: ${hasStructuredContent ? '✅' : '❌'}`);
      
    } else {
      console.log(`提取失败: ${result.error}`);
    }
    
  } catch (error) {
    console.log(`发生错误: ${error.message}`);
  }
}

// 运行测试
if (require.main === module) {
  (async () => {
    await testScraperImprovement();
    await compareBeforeAfter();
  })();
}

module.exports = {
  testScraperImprovement,
  compareBeforeAfter,
  assessContentQuality
};