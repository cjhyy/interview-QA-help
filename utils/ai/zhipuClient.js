const axios = require('axios');
const { AI_CONFIG } = require('../../constants');

class ZhipuClient {
  constructor() {
    this.apiKey = process.env.ZHIPU_API_KEY;
    this.model = process.env.ZHIPU_MODEL || AI_CONFIG.ZHIPU_MODEL;
    this.baseURL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
  }

  /**
   * 调用智谱AI API
   */
  async callAPI(prompt, options = {}) {
    if (!this.apiKey) {
      throw new Error('智谱AI API密钥未配置');
    }

    try {
      const response = await axios.post(this.baseURL, {
        model: this.model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: options.temperature || AI_CONFIG.TEMPERATURE,
        max_tokens: options.maxTokens || AI_CONFIG.MAX_TOKENS
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: options.timeout || AI_CONFIG.TIMEOUT
      });

      if (response.data && response.data.choices && response.data.choices[0]) {
        return response.data.choices[0].message.content;
      } else {
        throw new Error('智谱AI返回格式异常');
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`智谱AI API错误: ${error.response.status} - ${error.response.data?.error?.message || '未知错误'}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('智谱AI API请求超时');
      } else {
        throw new Error(`智谱AI API调用失败: ${error.message}`);
      }
    }
  }

  /**
   * 检查API是否可用
   */
  async isAvailable() {
    try {
      await this.callAPI('测试连接', { maxTokens: 10 });
      return true;
    } catch (error) {
      console.error('智谱AI不可用:', error.message);
      return false;
    }
  }
}

module.exports = ZhipuClient;