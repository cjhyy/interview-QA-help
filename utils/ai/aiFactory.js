const ZhipuClient = require('./zhipuClient');
const OpenAIClient = require('./openaiClient');

class AIFactory {
  constructor() {
    this.zhipuClient = new ZhipuClient();
    this.openaiClient = new OpenAIClient();
    this.currentClient = null;
    this.clientType = null;
  }

  /**
   * 初始化AI客户端
   */
  async initialize() {
    // 优先使用智谱AI
    if (process.env.ZHIPU_API_KEY) {
      try {
        const isZhipuAvailable = await this.zhipuClient.isAvailable();
        if (isZhipuAvailable) {
          this.currentClient = this.zhipuClient;
          this.clientType = 'zhipu';
          console.log('🤖 使用智谱AI进行内容总结');
          return;
        }
      } catch (error) {
        console.warn('智谱AI初始化失败:', error.message);
      }
    }

    // 备用OpenAI
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here') {
      try {
        const isOpenAIAvailable = await this.openaiClient.isAvailable();
        if (isOpenAIAvailable) {
          this.currentClient = this.openaiClient;
          this.clientType = 'openai';
          console.log('🤖 使用OpenAI进行内容总结');
          return;
        }
      } catch (error) {
        console.warn('OpenAI初始化失败:', error.message);
      }
    }

    throw new Error('未配置有效的AI服务密钥');
  }

  /**
   * 调用AI API
   */
  async callAPI(prompt, options = {}) {
    if (!this.currentClient) {
      await this.initialize();
    }

    return await this.currentClient.callAPI(prompt, options);
  }

  /**
   * 获取当前使用的AI服务类型
   */
  getClientType() {
    return this.clientType;
  }

  /**
   * 检查AI服务是否可用
   */
  async isAvailable() {
    if (!this.currentClient) {
      try {
        await this.initialize();
        return true;
      } catch (error) {
        return false;
      }
    }

    return await this.currentClient.isAvailable();
  }

  /**
   * 切换AI服务
   */
  async switchClient(clientType) {
    if (clientType === 'zhipu' && process.env.ZHIPU_API_KEY) {
      this.currentClient = this.zhipuClient;
      this.clientType = 'zhipu';
    } else if (clientType === 'openai' && process.env.OPENAI_API_KEY) {
      this.currentClient = this.openaiClient;
      this.clientType = 'openai';
    } else {
      throw new Error(`不支持的AI服务类型: ${clientType}`);
    }

    const isAvailable = await this.currentClient.isAvailable();
    if (!isAvailable) {
      throw new Error(`${clientType} AI服务不可用`);
    }

    console.log(`🔄 已切换到 ${clientType} AI服务`);
  }
}

module.exports = AIFactory;