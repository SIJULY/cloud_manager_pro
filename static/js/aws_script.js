document.addEventListener('DOMContentLoaded', function() {
    // UI元素引用
    const UI = {
        currentAccountStatus: document.getElementById('currentAccountStatus'),
        saveAccountBtn: document.getElementById('saveAccountBtn'),
        accountList: document.getElementById('accountList'),
        queryAllQuotasBtn: document.getElementById('queryAllQuotasBtn'),
        regionSelector: document.getElementById('regionSelector'),
        activateRegionBtn: document.getElementById('activateRegionBtn'),
        setDefaultRegionBtn: document.getElementById('setDefaultRegionBtn'),
        querySelectedRegionBtn: document.getElementById('querySelectedRegionBtn'),
        queryAllRegionsBtn: document.getElementById('queryAllRegionsBtn'),
        createEc2Btn: document.getElementById('createEc2Btn'),
        createLsBtn: document.getElementById('createLsBtn'),
        userData: document.getElementById('userData'),
        instanceList: document.getElementById('instanceList'),
        logOutput: document.getElementById('logOutput'),
        clearLogBtn: document.getElementById('clearLogBtn'),
        ec2TypeModal: new bootstrap.Modal(document.getElementById('ec2TypeModal')),
        lightsailTypeModal: new bootstrap.Modal(document.getElementById('lightsailTypeModal')),
        ec2TypeSelector: document.getElementById('ec2TypeSelector'),
        ec2DiskSize: document.getElementById('ec2DiskSize'),
        lightsailTypeSelector: document.getElementById('lightsailTypeSelector'),
        confirmEc2CreationBtn: document.getElementById('confirmEc2CreationBtn'),
        confirmLightsailCreationBtn: document.getElementById('confirmLightsailCreationBtn'),
        ec2Spinner: document.getElementById('ec2Spinner'),
        lightsailSpinner: document.getElementById('lightsailSpinner'),
        paginationNav: document.getElementById('pagination-nav'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        restartBtn: document.getElementById('restartBtn'),
        changeIpBtn: document.getElementById('changeIpBtn'),
        deleteBtn: document.getElementById('deleteBtn'),
        
        connectedProfileEmptyState: document.getElementById('connectedProfileEmptyState'),
        connectedProfileDetails: document.getElementById('connectedProfileDetails'),
        connectedProfileAlias: document.getElementById('connectedProfileAlias'),
        connectedProfileKey: document.getElementById('connectedProfileKey'),
        connectedProfileRegion: document.getElementById('connectedProfileRegion'),
        disconnectAccountBtn: document.getElementById('disconnectAccountBtn'),
        
        // --- 新增：顶部区域卡片的元素引用 ---
        currentRegionStatValue: document.getElementById('currentRegionStatValue'),
        currentRegionStatSub: document.getElementById('currentRegionStatSub')
    };
    
    let logPollingInterval = null;
    let currentPage = 1;
    let selectedInstance = null;

    // 辅助函数
    const log = (message, type = 'info') => {
        const now = new Date().toLocaleTimeString();
        const colorClass = type === 'error' ? 'text-danger' : (type === 'success' ? 'text-success' : 'text-warning');
        UI.logOutput.innerHTML += `<div class="${colorClass}">[${now}] ${message}</div>`;
        UI.logOutput.scrollTop = UI.logOutput.scrollHeight;
    };

    const apiCall = async (url, options = {}) => {
        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                log('会话已过期，正在跳转到登录页...', 'error');
                window.location.href = '/login';
                throw new Error("Redirecting to login");
            }
            if (!response.ok) {
                let errorMsg = `HTTP 错误! 状态: ${response.status}`;
                try { const errData = await response.json(); errorMsg = errData.error || JSON.stringify(errData); }
                catch (e) { errorMsg = await response.text(); }
                throw new Error(errorMsg);
            }
            const data = await response.json();
            if (data.error) {
                log(data.error, 'error');
            }
            return data;
        } catch (error) { log(error.message, 'error'); throw error; }
    };

    const formatDuration = (isoString) => {
        if (!isoString) return 'N/A';
        const launchTime = new Date(isoString);
        const now = new Date();
        let seconds = Math.floor((now - launchTime) / 1000);
        if (seconds < 0) return '未来时间';
        if (seconds < 60) return `${seconds} 秒`;
        let days = Math.floor(seconds / (24 * 3600));
        seconds %= (24 * 3600);
        let hours = Math.floor(seconds / 3600);
        seconds %= 3600;
        let minutes = Math.floor(seconds / 60);
        let result = '';
        if (days > 0) result += `${days}天 `;
        if (hours > 0) result += `${hours}小时 `;
        if (minutes > 0) result += `${minutes}分钟`;
        return result.trim() || '刚刚启动';
    };

    const renderInstanceRow = (inst) => {
        const row = document.createElement('tr');
        row.dataset.id = inst.id;
        row.dataset.name = inst.name || inst.id;
        row.dataset.region = inst.region;
        row.dataset.type = inst.type;
        row.dataset.state = inst.state;
        
        const uptime = (inst.state === 'running' || inst.state === 'pending') ? formatDuration(inst.launch_time) : '已停止';
        const isRunning = inst.state === 'running';

        row.innerHTML = `
            <td><span class="badge bg-${inst.type === 'EC2' ? 'success' : 'info'}">${inst.type}</span></td>
            <td class="text-center">${inst.region}</td>
            <td class="text-center">${inst.name || inst.id}</td>
            <td class="text-center"><span class="badge bg-${isRunning ? 'success' : (inst.state === 'stopped' ? 'secondary' : 'warning')}">${inst.state}</span></td>
            <td class="text-center">${inst.ip}</td>
            <td class="text-center">${uptime}</td>
        `;
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => {
            if (selectedInstance) {
                selectedInstance.classList.remove('table-active');
            }
            row.classList.add('table-active');
            selectedInstance = row;
            updateActionButtonsState();
        });
        UI.instanceList.appendChild(row);
    };

    const updateActionButtonsState = () => {
        const setButtonState = (button, activeClass, isEnabled) => {
            button.disabled = !isEnabled;
            button.classList.remove('btn-success', 'btn-warning', 'btn-secondary', 'btn-info', 'btn-danger');
            if (isEnabled) {
                button.classList.add(activeClass);
            } else {
                button.classList.add('btn-secondary');
            }
        };

        if (!selectedInstance) {
            setButtonState(UI.startBtn, 'btn-success', false);
            setButtonState(UI.stopBtn, 'btn-warning', false);
            setButtonState(UI.restartBtn, 'btn-success', false);
            setButtonState(UI.changeIpBtn, 'btn-info', false);
            setButtonState(UI.deleteBtn, 'btn-danger', false);
            return;
        }

        const state = selectedInstance.dataset.state;
        const type = selectedInstance.dataset.type;
        const isRunning = state === 'running';
        const isStopped = state === 'stopped';

        setButtonState(UI.startBtn, 'btn-success', isStopped);
        setButtonState(UI.stopBtn, 'btn-warning', isRunning);
        setButtonState(UI.restartBtn, 'btn-success', isRunning);
        setButtonState(UI.deleteBtn, 'btn-danger', !(isRunning && type === 'EC2'));
        setButtonState(UI.changeIpBtn, 'btn-info', isRunning && type === 'EC2');
    };

    const handleActionClick = async (action) => {
        if (!selectedInstance) {
            log('错误：请先在列表中选择一个实例。', 'error');
            return;
        }
        const instance = {
            id: selectedInstance.dataset.id,
            name: selectedInstance.dataset.name,
            region: selectedInstance.dataset.region,
            type: selectedInstance.dataset.type,
        };
        const confirmText = {
            start: `确定要启动实例 ${instance.name}?`,
            stop: `确定要停止实例 ${instance.name}?`,
            restart: `确定要重启实例 ${instance.name}?`,
            delete: `【警告】此操作不可恢复！确定要永久删除实例 ${instance.name} 吗?`,
            'change-ip': `确定要为实例 ${instance.name} 分配一个新的IP地址吗？这会产生少量费用，并自动释放旧IP。`
        };
        if (!confirm(confirmText[action])) return;
        log(`正在对实例 ${instance.name} 执行 ${action} 操作...`);
        try {
            const payload = {
                action: action,
                instance_id: instance.id,
                region: instance.region,
                instance_type: instance.type
            };
            const response = await apiCall('/aws/api/instance-action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response && response.message) {
                log(response.message, 'success');
            }
            setTimeout(() => UI.querySelectedRegionBtn.dispatchEvent(new Event('click')), 5000);
        } catch (error) {
            setTimeout(() => UI.querySelectedRegionBtn.dispatchEvent(new Event('click')), 500);
        }
    };
    
    const startLogPolling = (taskId) => {
        if (logPollingInterval) {
            clearInterval(logPollingInterval);
            logPollingInterval = null;
        }
        UI.instanceList.innerHTML = `<tr><td colspan="6" class="text-center" data-loading-row="true">查询中... <div class="spinner-border spinner-border-sm"></div></td></tr>`;
        
        logPollingInterval = setInterval(async () => {
            try {
                const data = await apiCall(`/aws/api/task/${taskId}/logs`);
                if (data && data.logs) {
                    const loadingRow = UI.instanceList.querySelector('td[data-loading-row="true"]');
                    if (loadingRow) {
                        loadingRow.parentNode.remove();
                    }

                    data.logs.forEach(logLine => {
                        if (logLine.startsWith("FOUND_INSTANCE::")) {
                            try {
                                const instanceData = JSON.parse(logLine.substring("FOUND_INSTANCE::".length));
                                if (!document.querySelector(`[data-id="${instanceData.id}"]`)) {
                                    renderInstanceRow(instanceData);
                                }
                            } catch (e) {
                                log("无法解析实例数据: " + logLine, 'error');
                            }
                        } else {
                            log(logLine);
                        }
                    });

                    if (data.logs.includes("--- 任务完成 ---")) {
                        clearInterval(logPollingInterval);
                        logPollingInterval = null;
                        log("所有区域查询任务已完成。", 'success');
                        
                        if (UI.instanceList.rows.length === 0) {
                            UI.instanceList.innerHTML = `<tr><td colspan="6" class="text-center text-muted">未找到实例</td></tr>`;
                        }
                    }
                }
            } catch (error) {
                clearInterval(logPollingInterval);
                logPollingInterval = null;
                log("日志轮询失败或任务已结束。", 'error');
            }
        }, 1000);
    };
    
    const setUIState = (isAwsLoggedIn) => {
        [UI.createEc2Btn, UI.createLsBtn, UI.querySelectedRegionBtn, UI.queryAllRegionsBtn, UI.regionSelector, UI.disconnectAccountBtn, UI.setDefaultRegionBtn, UI.queryAllQuotasBtn].forEach(el => {
            if(el) el.disabled = !isAwsLoggedIn;
        });
        if (UI.activateRegionBtn) UI.activateRegionBtn.disabled = true;
    };
    
    const renderPagination = (totalPages, currentPage) => {
        if (!UI.paginationNav) return;
        UI.paginationNav.innerHTML = '';
        if (totalPages <= 1) return;
        let paginationHTML = '<ul class="pagination pagination-sm">';
        paginationHTML += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage - 1}">‹</a></li>`;
        for (let i = 1; i <= totalPages; i++) {
            paginationHTML += `<li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
        }
        paginationHTML += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" data-page="${currentPage + 1}">›</a></li>`;
        paginationHTML += '</ul>';
        UI.paginationNav.innerHTML = paginationHTML;
    };
    
    const loadAndRenderAccounts = async (page = 1) => {
        try {
            const data = await apiCall(`/aws/api/accounts?page=${page}&limit=50`);
            if (!data) return;
            currentPage = data.current_page;
            
            UI.accountList.innerHTML = data.accounts.length ? data.accounts.map(acc => `
                <tr data-account-name="${acc.name}">
                    <td class="align-middle fw-bold">${acc.name}</td>
                    <td class="align-middle"><code>${acc.access_key || '********'}</code></td>
                    <td class="align-middle text-info">${acc.default_region || 'us-east-1'}</td>
                    <td class="text-end align-middle">
                        <div class="d-flex justify-content-end gap-1">
                            <button class="btn btn-success btn-sm" data-action="select">连接</button>
                            <button class="btn btn-info btn-sm text-white" data-action="query-quota">配额</button>
                            <button class="btn btn-danger btn-sm" data-action="delete"><i class="bi bi-trash"></i></button>
                        </div>
                    </td>
                </tr>`).join('') : '<tr><td colspan="4" class="text-center text-muted py-4">没有已保存的账户</td></tr>';
            
            renderPagination(data.total_pages, data.current_page);
            updateAwsLoginStatus();
        } catch (error) {
            UI.accountList.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">加载账户列表失败</td></tr>';
        }
    };
    
    const updateAwsLoginStatus = async () => {
        try {
            const data = await apiCall('/aws/api/session');
            if (data && data.logged_in) {
                UI.currentAccountStatus.innerHTML = `(当前: <span class="fw-bold text-success">${data.name}</span>)`;
                setUIState(true);
                
                if (UI.connectedProfileEmptyState) UI.connectedProfileEmptyState.classList.add('d-none');
                if (UI.connectedProfileDetails) UI.connectedProfileDetails.classList.remove('d-none');
                if (UI.connectedProfileAlias) UI.connectedProfileAlias.textContent = data.name;
                
                let maskedAk = '********';
                const accountRow = document.querySelector(`tr[data-account-name="${data.name}"]`);
                if (accountRow) {
                    const codeEl = accountRow.querySelector('code');
                    if (codeEl) maskedAk = codeEl.textContent;
                }
                if (UI.connectedProfileKey) UI.connectedProfileKey.textContent = maskedAk;
                if (UI.connectedProfileRegion) UI.connectedProfileRegion.textContent = UI.regionSelector.value || 'us-east-1';

                loadRegions();
            } else {
                UI.currentAccountStatus.innerHTML = `(<span class="fw-bold text-danger">未选择</span>)`;
                setUIState(false);
                UI.regionSelector.innerHTML = '<option>请先选择AWS账户</option>';
                
                if (UI.connectedProfileEmptyState) UI.connectedProfileEmptyState.classList.remove('d-none');
                if (UI.connectedProfileDetails) UI.connectedProfileDetails.classList.add('d-none');
                
                // --- 还原顶部区域卡片状态 ---
                if (UI.currentRegionStatValue) UI.currentRegionStatValue.textContent = '未连接';
                if (UI.currentRegionStatSub) UI.currentRegionStatSub.textContent = '请先选择并连接 AWS 账户';
            }
        } catch (error) { setUIState(false); }
    };
    
    const loadRegions = async () => {
        log('正在加载区域列表...');
        try {
            const regions = await apiCall('/aws/api/regions');
            if (!regions) return;
            UI.regionSelector.innerHTML = regions.map(r => 
                `<option 
                    value="${r.code}" 
                    data-enabled="${r.enabled}" 
                    data-supports-lightsail="${r.supports_lightsail}">
                    ${r.name} ${r.enabled ? '' : '(未激活)'}
                </option>`
            ).join('');

            const defaultRegion = 'us-east-1';
            const optionExists = Array.from(UI.regionSelector.options).some(opt => opt.value === defaultRegion);
            if (optionExists) {
                UI.regionSelector.value = defaultRegion;
            }
            
            log('区域列表加载成功。', 'success');
            // 手动触发一次 change 事件以更新相关的卡片 UI
            UI.regionSelector.dispatchEvent(new Event('change'));
        } catch (error) { /* handled */ }
    };
    
    const openInstanceTypeModal = async (type) => {
        const region = UI.regionSelector.value;
        const modal = (type === 'ec2') ? UI.ec2TypeModal : UI.lightsailTypeModal;
        const selector = (type === 'ec2') ? UI.ec2TypeSelector : UI.lightsailTypeSelector;
        const spinner = (type === 'ec2') ? UI.ec2Spinner : UI.lightsailSpinner;
        const endpoint = (type === 'ec2') ? `/aws/api/ec2-instance-types?region=${region}` : `/aws/api/lightsail-bundles?region=${region}`;
        if (type === 'ec2') { UI.ec2DiskSize.value = ''; }
        modal.show();
        spinner.style.display = 'block';
        selector.innerHTML = '<option>正在加载...</option>';
        try {
            const data = await apiCall(endpoint);
            if (!data) throw new Error("未能获取实例类型数据");
            const format = (type === 'ec2')
                ? data.map(t => `<option value="${t.value}">${t.text}${t.value.includes('micro') ? ' (免费套餐可用)' : ''}</option>`).join('')
                : data.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
            selector.innerHTML = format;
        } catch (error) { selector.innerHTML = `<option>加载失败: ${error.message}</option>`; }
        finally { spinner.style.display = 'none'; }
    };
    
    const createInstance = async (type) => {
        const finalUserData = UI.userData.value;
        const payload = {
            region: UI.regionSelector.value,
            user_data: finalUserData,
            ...(type === 'ec2' ? { instance_type: UI.ec2TypeSelector.value } : { bundle_id: UI.lightsailTypeSelector.value })
        };
        if (type === 'ec2') {
            const diskSizeInput = UI.ec2DiskSize.value.trim();
            if (diskSizeInput) {
                const diskSize = parseInt(diskSizeInput, 10);
                if (!isNaN(diskSize) && diskSize > 0) { payload.disk_size = diskSize; }
            }
        }
        (type === 'ec2' ? UI.ec2TypeModal : UI.lightsailTypeModal).hide();
        log(`请求在 ${payload.region} 创建 ${type.toUpperCase()} 实例...`);
        if (payload.disk_size) { log(`自定义硬盘大小: ${payload.disk_size} GB`); }
        log(`发送的 User Data 脚本:\n${finalUserData}`);
        try {
            const data = await apiCall(`/aws/api/instances/${type}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (data && data.task_id) startLogPolling(data.task_id);
        } catch (error) { /* apiCall函数已处理日志 */ }
    };
    
    const queryQuota = async (accountName, region) => {
        if (!region) { log('请先在下方“操作区域”中选择一个区域再查询配额。', 'error'); return; }
        
        log(`正在为账户 ${accountName} 查询区域 ${region} 的 vCPU 配额...`);
        try {
            const data = await apiCall('/aws/api/query-quota', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account_name: accountName, region: region }) });
            if (data && data.quota !== undefined) {
                log(`✅ 账户 ${accountName} 在区域 ${region} 的 vCPU 配额为: ${data.quota}`, 'success');
                alert(`账户 ${accountName} 的 vCPU 配额: ${data.quota}`);
            } else {
                log(`账户 ${accountName} 的 vCPU 配额查询未能返回有效数据。`, 'error');
            }
        } catch (error) {
            log(`账户 ${accountName} 配额查询失败: ${error.message}`, 'error');
        }
    };
    
    UI.accountList.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;
        const action = button.dataset.action;
        const accountName = button.closest('tr').dataset.accountName;
        if (action === 'select') {
            log(`正在选择AWS账户 ${accountName}...`);
            await apiCall('/aws/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: accountName }) });
            log(`AWS账户 ${accountName} 选择成功。`, 'success');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('accountsModal'));
            if (modal) modal.hide();
            
            updateAwsLoginStatus();
        } else if (action === 'delete') {
            if (!confirm(`确定要删除AWS账户 ${accountName} 吗？`)) return;
            await apiCall(`/aws/api/accounts/${accountName}`, { method: 'DELETE' });
            log(`AWS账户 ${accountName} 删除成功。`, 'success');
            loadAndRenderAccounts(1);
        } else if (action === 'query-quota') {
            const region = UI.regionSelector.value || 'us-east-1';
            queryQuota(accountName, region);
        }
    });
    
    UI.saveAccountBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const form = document.getElementById('addAccountForm');
        
        const name = form.querySelector('input[name="name"]').value.trim();
        const access_key = form.querySelector('input[name="access_key"]').value.trim();
        const secret_key = form.querySelector('input[name="secret_key"]').value.trim();
        
        if (!name || !access_key || !secret_key) return alert('所有字段均为必填项！');
        
        const originalText = UI.saveAccountBtn.innerText;
        UI.saveAccountBtn.disabled = true;
        UI.saveAccountBtn.innerText = '保存中...';

        try {
            await apiCall('/aws/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, access_key, secret_key }) });
            log(`账户 ${name} 添加成功。`, 'success');
            form.reset();
            
            const addModal = bootstrap.Modal.getInstance(document.getElementById('addAccountModal'));
            if (addModal) addModal.hide();
            
            loadAndRenderAccounts(1);
        } catch (error) { 
            alert(`添加失败: ${error.message}`); 
        } finally {
            UI.saveAccountBtn.disabled = false;
            UI.saveAccountBtn.innerText = originalText;
        }
    });
    
    if (UI.paginationNav) {
        UI.paginationNav.addEventListener('click', (event) => {
            event.preventDefault();
            const link = event.target.closest('a.page-link');
            if (link) {
                const page = parseInt(link.dataset.page, 10);
                if (!isNaN(page)) {
                    loadAndRenderAccounts(page);
                }
            }
        });
    }
    
    UI.queryAllQuotasBtn.addEventListener('click', () => {
        const region = UI.regionSelector.value;
        if (!region || UI.regionSelector.disabled) { log('请先选择一个账户和一个区域再执行此操作。', 'error'); return; }
        log(`开始为所有账户查询区域 ${region} 的 vCPU 配额...`);
        const rows = UI.accountList.querySelectorAll('tr[data-account-name]');
        rows.forEach(row => {
            const accountName = row.dataset.accountName;
            queryQuota(accountName, region);
        });
    });

    UI.regionSelector.addEventListener('change', () => {
        const selectedOption = UI.regionSelector.options[UI.regionSelector.selectedIndex];
        if (selectedOption) {
            const isEnabled = (selectedOption.dataset.enabled === 'true');
            const supportsLightsail = (selectedOption.dataset.supportsLightsail === 'true');

            UI.activateRegionBtn.disabled = isEnabled;
            UI.activateRegionBtn.className = isEnabled ? 'btn btn-sm btn-secondary' : 'btn btn-sm btn-warning';

            UI.createEc2Btn.disabled = !isEnabled;
            UI.createEc2Btn.title = isEnabled ? '创建 EC2 实例' : '请先激活此区域后再创建实例';

            UI.createLsBtn.disabled = !isEnabled || !supportsLightsail;
            UI.createLsBtn.title = !isEnabled ? '请先激活此区域' : (!supportsLightsail ? '此区域不支持Lightsail' : '创建 Lightsail 实例');
            
            // --- 同步更新所有关联该区域的UI展示 ---
            if (UI.connectedProfileRegion) {
                UI.connectedProfileRegion.textContent = UI.regionSelector.value;
            }
            if (UI.currentRegionStatValue) {
                UI.currentRegionStatValue.textContent = selectedOption.value; // e.g. ap-northeast-1
                // 截取类似 "(东京)" 这样的格式用于展示
                let displayName = selectedOption.text.replace(selectedOption.value, '').trim();
                if (!displayName) displayName = '未知区域';
                UI.currentRegionStatSub.textContent = displayName;
            }
        }
    });

    UI.activateRegionBtn.addEventListener('click', async () => {
        const region = UI.regionSelector.value;
        if (!region || UI.activateRegionBtn.disabled) return;
        if (!confirm(`确定要激活区域 ${region} 吗？`)) return;
        try {
            const data = await apiCall('/aws/api/activate-region', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ region }) });
            if(data && data.task_id) startLogPolling(data.task_id);
        } catch(e) {}
    });
    
    if (UI.setDefaultRegionBtn) {
        UI.setDefaultRegionBtn.addEventListener('click', () => {
            const modal = bootstrap.Modal.getInstance(document.getElementById('regionQuotaModal'));
            if (modal) modal.hide();
            
            if (UI.querySelectedRegionBtn && !UI.querySelectedRegionBtn.disabled) {
                UI.querySelectedRegionBtn.click();
            }
        });
    }

    UI.querySelectedRegionBtn.addEventListener('click', () => {
        selectedInstance = null;
        updateActionButtonsState();
        const region = UI.regionSelector.value;
        log(`正在查询区域 ${region} 的实例...`);
        UI.instanceList.innerHTML = `<tr><td colspan="6" class="text-center">查询中... <div class="spinner-border spinner-border-sm"></div></td></tr>`;
        apiCall(`/aws/api/instances?region=${region}`).then(instances => {
            UI.instanceList.innerHTML = '';
            if (instances && instances.length > 0) {
                instances.forEach(renderInstanceRow);
            } else {
                UI.instanceList.innerHTML = `<tr><td colspan="6" class="text-center text-muted">该区域无实例</td></tr>`;
            }
            log(`区域 ${region} 查询完成。`, 'success');
        }).catch(error => {
            UI.instanceList.innerHTML = `<tr><td colspan="6" class="text-center text-danger">查询失败: ${error.message}</td></tr>`;
        });
    });
    UI.queryAllRegionsBtn.addEventListener('click', () => {
        selectedInstance = null;
        updateActionButtonsState();
        log("即将查询所有区域，过程可能较慢，请稍候...");
        apiCall('/aws/api/query-all-instances', { method: 'POST' })
            .then(data => {
                if(data && data.task_id) startLogPolling(data.task_id);
            });
    });
    
    if (UI.disconnectAccountBtn) {
        UI.disconnectAccountBtn.addEventListener('click', async () => {
            if (!confirm('确定要断开当前账号的连接吗？')) return;
            try {
                await apiCall('/aws/api/session', { method: 'DELETE' });
                log('已断开当前账户连接。', 'success');
                updateAwsLoginStatus();
                UI.instanceList.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">请先连接账户并点击刷新</td></tr>';
            } catch (error) {}
        });
    }
    
    UI.startBtn.addEventListener('click', () => handleActionClick('start'));
    UI.stopBtn.addEventListener('click', () => handleActionClick('stop'));
    UI.restartBtn.addEventListener('click', () => handleActionClick('restart'));
    UI.changeIpBtn.addEventListener('click', () => handleActionClick('change-ip'));
    UI.deleteBtn.addEventListener('click', () => handleActionClick('delete'));
    UI.createEc2Btn.addEventListener('click', () => openInstanceTypeModal('ec2'));
    UI.createLsBtn.addEventListener('click', () => openInstanceTypeModal('lightsail'));
    UI.confirmEc2CreationBtn.addEventListener('click', () => createInstance('ec2'));
    UI.confirmLightsailCreationBtn.addEventListener('click', () => createInstance('lightsail'));
    UI.clearLogBtn.addEventListener('click', () => { UI.logOutput.innerHTML = ''; });
    
    // --- 初始化 ---
    loadAndRenderAccounts();
});
