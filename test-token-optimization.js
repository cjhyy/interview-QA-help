const axios = require('axios');

/**
 * 测试token优化效果
 */
async function testTokenOptimization() {
  console.log('🧪 测试token长度优化效果...');
  
  const testUrl = 'https://httpbin.org/html';
  console.log('测试URL:', testUrl);
  
  try {
    // 发送总结请求
    const response = await axios.post('http://localhost:3006/api/summary/create', {
      url: testUrl
    });
    
    console.log('✅ 请求发送成功');
    console.log('响应:', response.data);
    
    if (response.data.success && response.data.taskId) {
      const taskId = response.data.taskId;
      console.log('\n⏳ 等待处理完成...');
      
      // 等待处理完成，增加等待时间
      let attempts = 0;
      const maxAttempts = 20;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        attempts++;
        
        try {
          const statusResponse = await axios.get(`http://localhost:3006/api/summary/status/${taskId}`);
          const status = statusResponse.data;
          
          console.log(`\n📊 处理状态 (尝试 ${attempts}/${maxAttempts}):`);
          console.log('状态:', status.status);
          
          if (status.status === 'completed') {
            console.log('✅ 处理完成!');
            console.log('标题:', status.data.title);
            console.log('总结长度:', status.data.summary?.length || 0);
            console.log('关键词数量:', status.data.keywords?.length || 0);
            
            // 获取问答数据
            try {
              const qaResponse = await axios.get(`http://localhost:3006/api/summary/${taskId}/qa`);
              console.log('\n📝 问答数据:');
              console.log('问答数量:', qaResponse.data.qaList?.length || 0);
              console.log('Markdown长度:', qaResponse.data.markdownContent?.length || 0);
              
              if (qaResponse.data.qaList && qaResponse.data.qaList.length > 0) {
                console.log('\n🎯 第一个问答示例:');
                const firstQA = qaResponse.data.qaList[0];
                console.log('问题:', firstQA.question);
                console.log('答案长度:', firstQA.answer?.length || 0);
                console.log('类型:', firstQA.type);
                console.log('难度:', firstQA.difficulty);
              }
              
              console.log('\n🎉 Token优化测试成功!');
              return;
            } catch (qaError) {
              console.error('❌ 获取问答数据失败:', qaError.message);
            }
            
            return;
          } else if (status.status === 'failed') {
            console.log('❌ 处理失败');
            console.log('错误信息:', status.error);
            return;
          } else {
            console.log('⏳ 仍在处理中...');
          }
        } catch (statusError) {
          console.error('❌ 查询状态失败:', statusError.message);
        }
      }
      
      console.log('⏰ 等待超时');
    } else {
      console.log('❌ 请求失败:', response.data);
    }
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
testTokenOptimization();