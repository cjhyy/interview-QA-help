const axios = require('axios');

/**
 * 测试流式处理功能
 */
async function testStreamingFeature() {
  console.log('🚀 开始测试流式处理功能...');
  
  try {
    // 1. 发送创建请求
    console.log('📤 发送创建请求...');
    const createResponse = await axios.post('http://localhost:3006/api/summary/create', {
      url: 'https://httpbin.org/html'
    });
    
    if (!createResponse.data.success) {
      throw new Error('创建请求失败: ' + createResponse.data.message);
    }
    
    const taskId = createResponse.data.taskId;
    console.log('✅ 任务创建成功，任务ID:', taskId);
    
    // 2. 轮询状态，观察流式处理进度
    let attempts = 0;
    const maxAttempts = 30;
    let lastStatus = '';
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        const statusResponse = await axios.get(`http://localhost:3006/api/summary/status/${taskId}`);
        const data = statusResponse.data;
        
        // 只在状态变化时打印
        if (data.status !== lastStatus) {
          console.log(`📊 状态更新 [${attempts}/${maxAttempts}]:`, {
            status: data.status,
            progress: data.progress || '无进度信息',
            timestamp: new Date().toLocaleTimeString()
          });
          lastStatus = data.status;
        }
        
        if (data.status === 'completed') {
          console.log('🎉 处理完成！');
          console.log('📋 结果摘要:');
          console.log('- 标题:', data.title || '无标题');
          console.log('- 总结长度:', data.summary ? data.summary.length : 0, '字符');
          console.log('- 关键词:', data.keywords || '无关键词');
          console.log('- 分类:', data.category || '无分类');
          console.log('- 质量得分:', data.qualityScore || '无评分');
          
          // 获取问答数据
          try {
            const qaResponse = await axios.get(`http://localhost:3006/api/summary/qa/${taskId}`);
            if (qaResponse.data.success && qaResponse.data.qaList) {
              console.log('📝 问答数据:');
              console.log('- 问答数量:', qaResponse.data.qaList.length);
              qaResponse.data.qaList.forEach((qa, index) => {
                console.log(`  ${index + 1}. [${qa.difficulty}] ${qa.question.substring(0, 50)}...`);
              });
            }
          } catch (qaError) {
            console.log('⚠️ 获取问答数据失败:', qaError.message);
          }
          
          return;
        }
        
        if (data.status === 'failed') {
          console.log('❌ 处理失败:', data.error || '未知错误');
          return;
        }
        
        // 等待2秒后继续轮询
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (statusError) {
        console.log('⚠️ 状态查询失败:', statusError.message);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log('⏰ 轮询超时，测试结束');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testStreamingFeature().then(() => {
  console.log('\n🏁 测试完成');
}).catch(error => {
  console.error('\n💥 测试异常:', error.message);
});