const { ChatOpenAI } = require('@langchain/openai');
const { AI_CONFIG } = require('../../constants');

class OpenAIClient {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.AI_MODEL || AI_CONFIG.DEFAULT_MODEL;
    
    if (this.apiKey && this.apiKey !== 'your_openai_api_key_here') {
      this.client = new ChatOpenAI({
        openAIApiKey: this.apiKey,
        modelName: this.model,
        temperature: AI_CONFIG.TEMPERATURE,
        maxTokens: AI_CONFIG.MAX_TOKENS,
        timeout: AI_CONFIG.TIMEOUT
      });
    }
  }

  /**
   * 调用OpenAI API
   */
  async callAPI(prompt, options = {}) {
    if (!this.client) {
      throw new Error('OpenAI API密钥未配置或无效');
    }

    try {
      const response = await this.client.call([{
        role: 'user',
        content: prompt
      }]);

      return response.content;
    } catch (error) {
      if (error.message.includes('timeout')) {
        throw new Error('OpenAI API请求超时');
      } else if (error.message.includes('rate limit')) {
        throw new Error('OpenAI API请求频率超限');
      } else if (error.message.includes('insufficient_quota')) {
        throw new Error('OpenAI API配额不足');
      } else {
        throw new Error(`OpenAI API调用失败: ${error.message}`);
      }
    }
  }

  /**
   * 检查API是否可用
   */
  async isAvailable() {
    try {
      if (!this.client) {
        return false;
      }
      await this.callAPI('测试连接');
      return true;
    } catch (error) {
      console.error('OpenAI不可用:', error.message);
      return false;
    }
  }
}

module.exports = OpenAIClient;