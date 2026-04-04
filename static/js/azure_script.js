document.addEventListener('DOMContentLoaded', function() {
    const UI = {
        vmList: document.getElementById('vmList'),
        accountList: document.getElementById('accountList'),
        addAccountForm: document.getElementById('addAccountForm'),
        currentAccountStatus: document.getElementById('currentAccountStatus'),
        refreshBtn: document.getElementById('refreshVms'),
        logOutput: document.getElementById('logOutput'),
        clearLogBtn: document.getElementById('clearLogBtn'),

        queryAllStatusBtn: document.getElementById('queryAllStatusBtn'),
        createVmModalBtn: document.getElementById('createVmModalBtn'),

        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        restartBtn: document.getElementById('restartBtn'),
        changeIpBtn: document.getElementById('changeIpBtn'),
        deleteBtn: document.getElementById('deleteBtn'),
        regionSelector: document.getElementById('regionSelector'),

        createVmCardBtn: document.getElementById('createVmCardBtn'),
        disconnectAccountBtn: document.getElementById('disconnectAccountBtn'),

        createVmBtn: document.getElementById('confirmCreateVmBtn'),
        userData: document.getElementById('userData'),

        createVmModal: document.getElementById('createVmModal') ? new bootstrap.Modal(document.getElementById('createVmModal')) : null,
        addAccountModal: document.getElementById('addAccountModal') ? new bootstrap.Modal(document.getElementById('addAccountModal')) : null,
        accountsModal: document.getElementById('accountsModal') ? bootstrap.Modal.getOrCreateInstance(document.getElementById('accountsModal')) : null,

        connectedProfileEmptyState: document.getElementById('connectedProfileEmptyState'),
        connectedProfileDetails: document.getElementById('connectedProfileDetails'),
        connectedProfileAlias: document.getElementById('connectedProfileAlias'),
        connectedProfileAppId: document.getElementById('connectedProfileAppId'),
        connectedProfileTenantId: document.getElementById('connectedProfileTenantId'),
        connectedProfileSubId: document.getElementById('connectedProfileSubId'),
        connectedProfileExpiration: document.getElementById('connectedProfileExpiration')
    };

    let selectedAccount = null;
    let selectedVm = null;

    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const color = type === 'error' ? 'text-danger' : type === 'success' ? 'text-success' : 'text-info';
        const logEntry = document.createElement('div');
        logEntry.className = `mb-1 ${color}`;
        logEntry.innerHTML = `[${timestamp}] ${message}`;
        UI.logOutput.appendChild(logEntry);
        UI.logOutput.scrollTop = UI.logOutput.scrollHeight;
    }

    async function apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(endpoint, options);
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || `请求失败 (${response.status})`);
                return data;
            } else {
                throw new Error(`返回非 JSON 数据 (HTTP ${response.status})。请检查后端路由或重新登录。`);
            }
        } catch (error) {
            throw error;
        }
    }

    function updateConnectedProfileUI(account) {
        if (!account) return;
        UI.currentAccountStatus.textContent = `已连接: ${account.name}`;
        UI.connectedProfileEmptyState.classList.add('d-none');
        UI.connectedProfileDetails.classList.remove('d-none');

        UI.connectedProfileAlias.textContent = account.name;
        UI.connectedProfileAlias.title = account.name;
        UI.connectedProfileAppId.textContent = account.client_id;
        UI.connectedProfileAppId.title = account.client_id;
        UI.connectedProfileTenantId.textContent = account.tenant_id;
        UI.connectedProfileTenantId.title = account.tenant_id;
        UI.connectedProfileSubId.textContent = account.subscription_id;
        UI.connectedProfileSubId.title = account.subscription_id;
        UI.connectedProfileExpiration.textContent = account.expiration_date || '永久 / 未设置';
    }

    function updateActionButtons() {
        const hasAccount = !!selectedAccount;
        if(UI.refreshBtn) UI.refreshBtn.disabled = !hasAccount;
        if(UI.queryAllStatusBtn) UI.queryAllStatusBtn.disabled = !hasAccount;
        if(UI.createVmModalBtn) UI.createVmModalBtn.disabled = !hasAccount;
        if(UI.createVmCardBtn) UI.createVmCardBtn.disabled = !hasAccount;
        if(UI.disconnectAccountBtn) UI.disconnectAccountBtn.disabled = !hasAccount;

        const hasVm = !!selectedVm;
        if(UI.startBtn) UI.startBtn.disabled = !hasVm;
        if(UI.stopBtn) UI.stopBtn.disabled = !hasVm;
        if(UI.restartBtn) UI.restartBtn.disabled = !hasVm;
        if(UI.changeIpBtn) UI.changeIpBtn.disabled = !hasVm;
        if(UI.deleteBtn) UI.deleteBtn.disabled = !hasVm;
    }

    // ✨ 核心修复：纯本地 JS 计算存活状态，还原 V1 逻辑 ✨
    const displaySubscriptionStatus = (row) => {
        if (!row) return;
        const statusCell = row.querySelector('.status-cell');
        const expirationDate = row.dataset.expirationDate;
        if (!expirationDate || expirationDate === 'null' || expirationDate === '' || expirationDate === 'undefined') {
            statusCell.innerHTML = `<span class="badge bg-secondary">未设置</span>`; return;
        }
        const today = new Date();
        const expiry = new Date(expirationDate);
        today.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        let statusText = `剩余 ${diffDays} 天`, badgeClass = 'bg-success';
        if (diffDays < 0) { statusText = '已过期'; badgeClass = 'bg-danger'; }
        else if (diffDays <= 7) { badgeClass = 'bg-danger'; }
        else if (diffDays <= 30) { badgeClass = 'bg-warning text-dark'; }
        statusCell.innerHTML = `<span class="badge ${badgeClass}">${statusText}</span>`;
    };

    if (UI.queryAllStatusBtn) {
        UI.queryAllStatusBtn.addEventListener('click', () => {
            log("正在计算列表中所有账户的到期状态...");
            UI.accountList.querySelectorAll('tr[data-account-name]').forEach(row => {
                displaySubscriptionStatus(row);
            });
            if (UI.accountsModal) UI.accountsModal.show();
        });
    }

    if (UI.disconnectAccountBtn) {
        UI.disconnectAccountBtn.addEventListener('click', async () => {
            if (!confirm('确定要断开当前 Azure 账号的连接吗？')) return;
            try { await apiCall('/azure/api/session', { method: 'DELETE' }); } catch(e) {}

            selectedAccount = null;
            selectedVm = null;
            UI.currentAccountStatus.textContent = '未连接';
            UI.connectedProfileEmptyState.classList.remove('d-none');
            UI.connectedProfileDetails.classList.add('d-none');
            UI.vmList.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5">请先连接账户并点击刷新</td></tr>';

            updateActionButtons();
            log('已断开当前 Azure 账户连接', 'success');
        });
    }

    function loadAccounts() {
        apiCall('/azure/api/accounts').then(accounts => {
            UI.accountList.innerHTML = '';
            if (accounts.length === 0) {
                UI.accountList.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无账户，请先添加</td></tr>';
                return;
            }
            accounts.forEach(acc => {
                const tr = document.createElement('tr');
                tr.dataset.accountName = acc.name;
                tr.dataset.expirationDate = acc.expiration_date || '';

                tr.innerHTML = `
                    <td class="align-middle fw-bold text-primary">${acc.name}</td>
                    <td class="align-middle">${(acc.client_id||'').substring(0, 6)}...</td>
                    <td class="align-middle">${(acc.tenant_id||'').substring(0, 6)}...</td>
                    <td class="status-cell align-middle text-center">--</td>
                    <td class="align-middle">${acc.expiration_date ? `<span class="text-success">${acc.expiration_date}</span>` : '<span class="text-muted">未设置</span>'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-success connect-btn" data-name="${acc.name}"><i class="bi bi-link"></i> 连接</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-name="${acc.name}"><i class="bi bi-trash"></i></button>
                    </td>
                `;

                tr.querySelector('.connect-btn').addEventListener('click', async () => {
                    selectedAccount = acc;
                    try { await apiCall('/azure/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: acc.name }) }); } catch(e) {}

                    updateConnectedProfileUI(acc);
                    updateActionButtons();
                    log(`已成功连接到 Azure 账户: ${acc.name}`, 'success');

                    if (UI.accountsModal) UI.accountsModal.hide();
                    loadVms();
                });

                tr.querySelector('.delete-btn').addEventListener('click', () => {
                    if (confirm(`确定要删除账户 ${acc.name} 吗？`)) {
                        apiCall(`/azure/api/accounts/${acc.name}`, { method: 'DELETE' }).then(() => {
                            log(`账户 ${acc.name} 已删除`, 'success');
                            if (selectedAccount && selectedAccount.name === acc.name) {
                                if (UI.disconnectAccountBtn) UI.disconnectAccountBtn.click();
                            }
                            loadAccounts();
                        });
                    }
                });
                UI.accountList.appendChild(tr);
            });
        }).catch(err => {
            log("加载账号失败: " + err.message, "error");
            UI.accountList.innerHTML = `<tr><td colspan="6" class="text-center text-danger">加载失败: ${err.message}</td></tr>`;
        });
    }

    if (UI.addAccountForm) {
        UI.addAccountForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());

            // ✨ 核心修复：强制把 HTML 表单里的 account_name 转换成 Python 需要的 name ✨
            if (data.account_name) {
                data.name = data.account_name;
                delete data.account_name;
            }

            const btn = document.getElementById('saveAccountBtn');
            if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 保存中...'; }

            apiCall('/azure/api/accounts', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
            }).then(() => {
                log('Azure 账户添加成功', 'success');
                e.target.reset();
                if (UI.addAccountModal) UI.addAccountModal.hide();
                loadAccounts();
            }).catch(err => {
                log('账户添加失败: ' + err.message, 'error');
            }).finally(() => {
                if (btn) { btn.disabled = false; btn.textContent = '保存账户'; }
            });
        });
    }

    function loadVms() {
        if (!selectedAccount) return log('请先连接一个 Azure 账号。', 'warning');
        log("正在获取 Azure 虚拟机列表...");
        UI.refreshBtn.disabled = true;
        UI.vmList.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-5"><div class="spinner-border spinner-border-sm"></div> 正在加载...</td></tr>';

        // 彻底还原 V1 调法：直接请求，不带 account_name 参数
        apiCall(`/azure/api/vms`).then(vms => {
            UI.vmList.innerHTML = '';
            selectedVm = null;
            updateActionButtons();

            if (vms.length === 0) {
                UI.vmList.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">该订阅下未找到虚拟机</td></tr>';
                return;
            }
            vms.forEach(vm => {
                const tr = document.createElement('tr');
                tr.style.cursor = 'pointer';
                let stateColor = 'status-other';
                if (vm.status.includes('running')) stateColor = 'status-running';
                if (vm.status.includes('deallocated') || vm.status.includes('stopped')) stateColor = 'status-stopped';

                tr.innerHTML = `
                    <td class="fw-bold" style="padding-left: 1rem;">${vm.name}</td>
                    <td class="text-center"><span class="badge bg-secondary">${vm.resource_group}</span></td>
                    <td class="text-center"><div class="status-cell"><span class="status-dot ${stateColor}"></span>${vm.status}</div></td>
                    <td class="text-center text-info">${vm.public_ip || '-'}</td>
                    <td class="text-center">${vm.location}</td>
                `;
                tr.addEventListener('click', () => {
                    document.querySelectorAll('#vmList tr').forEach(r => r.classList.remove('table-active'));
                    tr.classList.add('table-active');
                    selectedVm = vm;
                    updateActionButtons();
                });
                UI.vmList.appendChild(tr);
            });
            log("虚拟机列表加载成功", 'success');
        }).catch(error => {
            UI.vmList.innerHTML = `<tr><td colspan="5" class="text-center text-danger">加载失败: ${error.message}</td></tr>`;
            log(`加载虚拟机异常: ${error.message}`, 'error');
        }).finally(() => {
            UI.refreshBtn.disabled = false;
        });
    }

    function handleVmAction(action) {
        if (!selectedVm || !selectedAccount) return;
        if (!confirm(`确定要对 VM [${selectedVm.name}] 执行 [${action}] 操作吗？`)) return;

        log(`正在发送 ${action} 请求到 VM: ${selectedVm.name}...`);
        apiCall('/azure/api/vm-action', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: action, resource_group: selectedVm.resource_group, vm_name: selectedVm.name })
        }).then(res => {
            log(res.message || '操作已成功发送', 'success');
            setTimeout(loadVms, 2500);
        }).catch(err => log(err.message, 'error'));
    }

    if(UI.refreshBtn) UI.refreshBtn.addEventListener('click', loadVms);
    if(UI.startBtn) UI.startBtn.addEventListener('click', () => handleVmAction('start'));
    if(UI.stopBtn) UI.stopBtn.addEventListener('click', () => handleVmAction('stop'));
    if(UI.restartBtn) UI.restartBtn.addEventListener('click', () => handleVmAction('restart'));
    if(UI.deleteBtn) UI.deleteBtn.addEventListener('click', () => handleVmAction('delete'));

    if (UI.changeIpBtn) {
        UI.changeIpBtn.addEventListener('click', () => {
            if (!selectedVm || !selectedAccount) return;
            if (!confirm(`确定要为 [${selectedVm.name}] 重新申请静态 IP 吗？`)) return;
            log(`正在为 ${selectedVm.name} 更换 IP...`);

            apiCall('/azure/api/vm-change-ip', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resource_group: selectedVm.resource_group, vm_name: selectedVm.name })
            }).then(res => {
                log(res.message, 'success');
                setTimeout(loadVms, 3000);
            }).catch(err => log(err.message, 'error'));
        });
    }

    if (UI.createVmBtn) {
        UI.createVmBtn.addEventListener('click', async () => {
            if (!selectedAccount) return log('错误：未连接账户，无法创建', 'error');
            const region = UI.regionSelector.value;
            const vmSize = document.getElementById('vmSize').value;
            const vmOs = document.getElementById('vmOs').value;
            const diskSize = document.getElementById('vmDiskSize').value;

            log(`正在提交创建虚拟机任务: ${region} | ${vmSize} | ${vmOs}`);
            if (UI.createVmModal) UI.createVmModal.hide();

            let userDataB64 = "";
            const userDataRaw = UI.userData ? UI.userData.value.trim() : "";
            if (userDataRaw) {
                userDataB64 = btoa(unescape(encodeURIComponent(userDataRaw)));
            }

            const ipTypeSelector = document.getElementById('ipTypeSelector');
            const ipType = ipTypeSelector ? ipTypeSelector.value : "Static";

            const payload = {
                region: region, vm_size: vmSize,
                os_image: vmOs, disk_size: parseInt(diskSize, 10),
                ip_type: ipType, user_data: userDataB64
            };

            apiCall('/azure/api/create-vm', {
                method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)
            }).then(res => {
                log(res.message || '实例部署任务已提交后台执行', 'info');
            }).catch(e => {
                log("创建虚拟机任务提交失败: " + e.message, 'error');
            });
        });
    }

    if(UI.clearLogBtn) UI.clearLogBtn.addEventListener('click', () => { UI.logOutput.innerHTML = ''; });

    loadAccounts();
});
