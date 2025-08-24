const axios = require('axios');
require('dotenv').config();

async function testFallbackBehavior() {
  try {
    console.log('🧪 测试AI失败时的降级处理...');
    
    const testUrl = 'https://httpbin.org/html';
    console.log('测试URL:', testUrl);
    
    // 发送创建总结请求
    const response = await axios.post('http://localhost:3006/api/summary/create', {
      url: testUrl
    });
    
    console.log('✅ 请求发送成功');
    console.log('响应:', response.data);
    
    if (response.data.taskId) {
      console.log('\n⏳ 等待处理完成...');
      
      // 等待几秒钟让处理完成
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      // 查询处理状态
      const statusResponse = await axios.get(`http://localhost:3006/api/summary/status/${response.data.taskId}`);
      
      console.log('\n📊 处理状态:');
      console.log('状态:', statusResponse.data.status);
      console.log('标题:', statusResponse.data.title);
      console.log('原始内容长度:', statusResponse.data.originalContent ? statusResponse.data.originalContent.length : 0);
      console.log('总结:', statusResponse.data.summary);
      console.log('错误信息:', statusResponse.data.errorMessage);
      
      if (statusResponse.data.status === 'partial' && statusResponse.data.originalContent) {
        console.log('\n✅ 降级处理成功：AI失败但原始内容已保存');
      } else if (statusResponse.data.status === 'completed') {
        console.log('\n✅ 完整处理成功：AI和内容都正常');
      } else {
        console.log('\n❌ 处理失败');
      }
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    if (error.code) {
      console.error('错误代码:', error.code);
    }
  }
}

testFallbackBehavior();