class WebSummarizer {
    constructor() {
        this.apiBase = '/api/summary';
        this.currentTaskId = null;
        this.pollInterval = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadHistory();
    }

    bindEvents() {
        const urlInput = document.getElementById('urlInput');
        const summarizeBtn = document.getElementById('summarizeBtn');
        const copyBtn = document.getElementById('copyBtn');
        const newSummaryBtn = document.getElementById('newSummaryBtn');
        const closeErrorBtn = document.getElementById('closeErrorBtn');

        // 总结按钮点击事件
        summarizeBtn.addEventListener('click', () => this.startSummarize());

        // 输入框回车事件
        urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.startSummarize();
            }
        });

        // 复制按钮事件
        copyBtn.addEventListener('click', () => this.copySummary());

        // 新总结按钮事件
        newSummaryBtn.addEventListener('click', () => this.resetForm());

        // 关闭错误模态框事件
        closeErrorBtn.addEventListener('click', () => this.hideError());
    }

    async startSummarize() {
        const urlInput = document.getElementById('urlInput');
        const url = urlInput.value.trim();

        if (!url) {
            this.showError('请输入有效的网页地址');
            return;
        }

        if (!this.isValidUrl(url)) {
            this.showError('请输入有效的URL格式，例如：https://example.com');
            return;
        }

        try {
            this.showStatus('正在提交请求...');
            this.setProgress(10);

            const response = await fetch(`${this.apiBase}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '请求失败');
            }

            if (data.cached || data.status === 'completed') {
                // 如果是缓存结果或已完成，直接显示
                this.displayResult(data.data);
                this.hideStatus();
            } else {
                // 开始轮询状态
                this.currentTaskId = data.taskId;
                this.startPolling();
            }

        } catch (error) {
            console.error('Error:', error);
            this.showError(error.message || '网络请求失败，请稍后重试');
            this.hideStatus();
        }
    }

    async startPolling() {
        this.setProgress(20);
        this.showStatus('正在抓取网页内容...');

        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.apiBase}/status/${this.currentTaskId}`);
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || '状态查询失败');
                }

                this.updateProgress(data.status);

                if (data.status === 'completed') {
                    clearInterval(this.pollInterval);
                    this.displayResult(data.data);
                    this.hideStatus();
                    this.loadHistory(); // 刷新历史记录
                } else if (data.status === 'failed') {
                    clearInterval(this.pollInterval);
                    this.showError(data.error || '处理失败');
                    this.hideStatus();
                }

            } catch (error) {
                console.error('Polling error:', error);
                clearInterval(this.pollInterval);
                this.showError('状态查询失败，请刷新页面重试');
                this.hideStatus();
            }
        }, 2000); // 每2秒查询一次
    }

    updateProgress(status) {
        const statusMessages = {
            'pending': { message: '任务排队中...', progress: 25 },
            'scraping': { message: '正在抓取网页内容...', progress: 40 },
            'processing': { message: 'AI正在分析和总结...', progress: 70 },
            'saving': { message: '正在保存结果...', progress: 90 },
            'completed': { message: '处理完成！', progress: 100 }
        };

        const statusInfo = statusMessages[status] || { message: '处理中...', progress: 50 };
        this.showStatus(statusInfo.message);
        this.setProgress(statusInfo.progress);
    }

    displayResult(data) {
        // 填充页面信息
        document.getElementById('pageTitle').textContent = data.title || '无标题';
        document.getElementById('pageUrl').textContent = data.url;
        document.getElementById('pageUrl').href = data.url;
        document.getElementById('pageLanguage').textContent = data.language || '未知';
        document.getElementById('pageCategory').textContent = data.category || '未分类';
        document.getElementById('qualityScore').textContent = data.qualityScore || 'N/A';

        // 填充总结内容
        const summaryContent = document.getElementById('summaryContent');
        if (data.qaCount && data.qaCount > 0) {
            summaryContent.innerHTML = `<p class="text-blue-600 mb-3">共生成 ${data.qaCount} 个面试问答</p><p class="text-gray-500">正在加载问答内容...</p>`;
            this.loadInterviewQA(data.id);
        } else {
            summaryContent.innerHTML = '<p class="text-gray-500">暂无问答内容</p>';
        }

        // 填充关键词
        const keywordsContainer = document.getElementById('keywordsContainer');
        keywordsContainer.innerHTML = '';
        if (data.keywords && data.keywords.length > 0) {
            data.keywords.forEach(keyword => {
                const tag = document.createElement('span');
                tag.className = 'bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full';
                tag.textContent = keyword;
                keywordsContainer.appendChild(tag);
            });
        }

        // 显示结果区域
        document.getElementById('resultArea').classList.remove('hidden');
        document.getElementById('resultArea').classList.add('fade-in');

        // 滚动到结果区域
        document.getElementById('resultArea').scrollIntoView({ behavior: 'smooth' });
    }

    async loadInterviewQA(summaryId) {
        try {
            const response = await fetch(`${this.apiBase}/qa/${summaryId}`);
            const data = await response.json();
            
            if (response.ok && data.success) {
                this.displayInterviewQA(data.data);
            } else {
                document.getElementById('summaryContent').innerHTML = '<p class="text-red-500">加载问答失败</p>';
            }
        } catch (error) {
            console.error('Failed to load interview QA:', error);
            document.getElementById('summaryContent').innerHTML = '<p class="text-red-500">加载问答失败</p>';
        }
    }

    displayInterviewQA(qaList) {
        const summaryContent = document.getElementById('summaryContent');
        
        if (!qaList || qaList.length === 0) {
            summaryContent.innerHTML = '<p class="text-gray-500">暂无问答内容</p>';
            return;
        }
        
        let html = `<div class="mb-4"><span class="text-blue-600 font-semibold">共 ${qaList.length} 个面试问答</span></div>`;
        
        qaList.forEach((qa, index) => {
            html += `
                <div class="mb-6 p-4 border border-gray-200 rounded-lg">
                    <div class="mb-3">
                        <span class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">Q${index + 1}</span>
                        ${qa.tags && qa.tags.length > 0 ? qa.tags.map(tag => `<span class="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mr-1">${this.escapeHtml(tag)}</span>`).join('') : ''}
                    </div>
                    <div class="mb-3">
                        <h4 class="font-semibold text-gray-800 mb-2">问题：</h4>
                        <p class="text-gray-700">${this.escapeHtml(qa.question)}</p>
                    </div>
                    <div>
                        <h4 class="font-semibold text-gray-800 mb-2">答案：</h4>
                        <div class="text-gray-700">${this.formatAnswer(qa.answer)}</div>
                    </div>
                </div>
            `;
        });
        
        summaryContent.innerHTML = html;
    }

    formatAnswer(answer) {
        if (!answer) return '<p class="text-gray-500">暂无答案</p>';
        
        // 简单的格式化：将换行转换为段落
        const paragraphs = answer.split('\n').filter(p => p.trim());
        return paragraphs.map(p => `<p class="mb-2">${this.escapeHtml(p)}</p>`).join('');
    }

    formatSummary(summary) {
        if (!summary) return '<p class="text-gray-500">暂无总结内容</p>';
        
        // 简单的格式化：将换行转换为段落
        const paragraphs = summary.split('\n').filter(p => p.trim());
        return paragraphs.map(p => `<p class="mb-3">${this.escapeHtml(p)}</p>`).join('');
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async loadHistory() {
        try {
            const response = await fetch(`${this.apiBase}/list?limit=6&sort=latest`);
            const data = await response.json();

            if (response.ok && data.success) {
                this.displayHistory(data.data);
            }
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    displayHistory(summaries) {
        const historyArea = document.getElementById('historyArea');
        historyArea.innerHTML = '';

        if (!summaries || summaries.length === 0) {
            historyArea.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">暂无历史记录</p>';
            return;
        }

        summaries.forEach(summary => {
            const card = this.createHistoryCard(summary);
            historyArea.appendChild(card);
        });
    }

    createHistoryCard(summary) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition-shadow cursor-pointer';
        
        const title = summary.title || '无标题';
        const shortSummary = summary.qaCount ? 
            `包含 ${summary.qaCount} 个面试问答` : 
            '暂无问答';
        
        const timeAgo = this.timeAgo(new Date(summary.createdAt));

        card.innerHTML = `
            <h3 class="font-semibold text-gray-800 mb-2 line-clamp-2">${this.escapeHtml(title)}</h3>
            <p class="text-sm text-gray-600 mb-3 line-clamp-3">${this.escapeHtml(shortSummary)}</p>
            <div class="flex justify-between items-center text-xs text-gray-500">
                <span><i class="fas fa-clock mr-1"></i>${timeAgo}</span>
                <span class="bg-gray-100 px-2 py-1 rounded">${summary.category || '未分类'}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            this.displayResult(summary);
            document.getElementById('urlInput').value = summary.url;
        });

        return card;
    }

    timeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '刚刚';
        if (minutes < 60) return `${minutes}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 30) return `${days}天前`;
        return date.toLocaleDateString();
    }

    copySummary() {
        const summaryContent = document.getElementById('summaryContent').textContent;
        const title = document.getElementById('pageTitle').textContent;
        const url = document.getElementById('pageUrl').textContent;
        
        const textToCopy = `标题：${title}\n网址：${url}\n\n面试问答：\n${summaryContent}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            this.showToast('问答内容已复制到剪贴板');
        }).catch(() => {
            this.showError('复制失败，请手动选择文本复制');
        });
    }

    resetForm() {
        document.getElementById('urlInput').value = '';
        document.getElementById('resultArea').classList.add('hidden');
        this.hideStatus();
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
    }

    showStatus(message) {
        document.getElementById('statusText').textContent = message;
        document.getElementById('statusArea').classList.remove('hidden');
    }

    hideStatus() {
        document.getElementById('statusArea').classList.add('hidden');
    }

    setProgress(percentage) {
        document.getElementById('progressBar').style.width = `${percentage}%`;
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorModal').classList.remove('hidden');
    }

    hideError() {
        document.getElementById('errorModal').classList.add('hidden');
    }

    showToast(message) {
        // 简单的toast提示
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new WebSummarizer();
});