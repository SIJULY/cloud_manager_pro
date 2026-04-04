# 修改版项目（cloud_manager-main）完整分析记忆文档

> 生成时间：自动生成  
> 用途：供后续开发参考，记录修改版与原始版的所有关键差异、架构现状、已知问题与待办事项

---

## 一、项目总览

| 属性 | 原始项目（cloudmanager） | 修改版项目（cloud_manager-main） |
|------|------------------------|-------------------------------|
| 路径 | /Users/xiaolongnvtaba/Downloads/cloudmanager | /Users/xiaolongnvtaba/Downloads/cloud_manager-main |
| 框架 | Flask + Celery + Redis | Flask + Celery + Redis（相同） |
| 主入口 | app.py | app.py |
| Celery 实例 | 在 app.py 内部直接创建 | 抽离到 extensions.py（已解决循环导入） |
| 端口 | 5000 | 5001 |
| UI 风格 | 原始Bootstrap默认风 | 深色科技控制台风格（已完整重构） |
| 新增文件 | — | extensions.py / static/ui_theme.css / UI_REFACTOR_PROGRESS.md |

---

## 二、目录结构差异

```
修改版新增文件：
├── extensions.py              # 共享 Celery 实例（解决循环导入关键文件）
├── static/ui_theme.css        # 全局深色科技主题 CSS
├── UI_REFACTOR_PROGRESS.md    # UI 重构进度记录（含大量已解决问题备忘）
├── Users/                     # 疑似误建的目录（需清理）

修改版与原始版相同的结构：
├── app.py
├── blueprints/
│   ├── api_bp.py
│   ├── aws_panel.py
│   ├── azure_panel.py
│   └── oci_panel.py
├── templates/
│   ├── layout.html
│   ├── login.html
│   ├── aws.html
│   ├── azure.html
│   ├── oci.html
│   └── mfa_setup.html
├── static/js/
│   ├── aws_script.js
│   ├── azure_script.js
│   └── oci_script.js
├── Dockerfile / docker-compose.yml / Caddyfile
├── install.sh / docker-install.sh / install_tgbot.sh
└── .env.example
```

---

## 三、app.py 核心改动

### 3.1 Celery 实例化方式变化（关键）

**原始版：**
```python
from celery import Celery
celery = Celery(app.name, broker=app.config['broker_url'])
celery.conf.update(app.config)
```

**修改版：**
```python
from extensions import celery, init_celery
# ...
init_celery(app)
```

- `extensions.py` 内容：
  ```python
  from celery import Celery
  celery = Celery(__name__)
  
  def init_celery(app):
      celery.conf.update(
          broker_url=app.config['broker_url'],
          result_backend=app.config['result_backend'],
          broker_connection_retry_on_startup=app.config.get('broker_connection_retry_on_startup', True)
      )
      return celery
  ```
- **原因**：原始版中 `azure_panel.py` 和 `oci_panel.py` 从 `app.py` 导入 Celery 实例，造成循环导入死锁，修改版通过抽离解决。

### 3.2 Redis 连接健壮性改进

**原始版：** 创建 redis_client 时不检测连通性，运行时连接失败直接 500。

**修改版：** 
- 启动时追加 `redis_client.ping()` 预检
- 新增 `is_redis_available()` 函数，每次操作前轻量检查
- 登录、防火墙、封禁等所有 Redis 操作均走 `is_redis_available()` 降级保护

```python
def is_redis_available():
    if not redis_client:
        return False
    try:
        redis_client.ping()
        return True
    except Exception as e:
        print(f"Warning: Redis unavailable during request: {e}")
        return False
```

### 3.3 运行端口变更

- 原始版：`port=5000`
- 修改版：`port=5001`

---

## 四、extensions.py（修改版新增）

```python
from celery import Celery

celery = Celery(__name__)

def init_celery(app):
    celery.conf.update(
        broker_url=app.config['broker_url'],
        result_backend=app.config['result_backend'],
        broker_connection_retry_on_startup=app.config.get('broker_connection_retry_on_startup', True)
    )
    return celery
```

- **所有 Blueprint 均从此处导入 celery**，不再从 app.py 导入
- `azure_panel.py` 和 `oci_panel.py` 均已更新为 `from extensions import celery`

---

## 五、UI 重构完成情况

### 5.1 全局主题（static/ui_theme.css）

已建立完整深色科技风 CSS 变量体系：

| 变量 | 值 | 说明 |
|------|----|------|
| --cm-bg | #0b1220 | 主背景色 |
| --cm-surface | rgba(15,23,42,0.88) | 卡片背景 |
| --cm-primary | #6366f1 | 主色调（紫蓝） |
| --cm-success | #10b981 | 成功绿 |
| --cm-danger | #ef4444 | 危险红 |
| --cm-warning | #f59e0b | 警告橙 |
| --cm-text | #e2e8f0 | 主文字色 |
| --cm-text-soft | #94a3b8 | 次要文字 |

覆盖的组件：
- Navbar / 顶部导航
- Card / Modal / Alert / Badge
- Form / Input / Select
- Table（含 thead 深色/hover 效果）
- Button（全系列 btn-* 渐变改造）
- Nav-tabs / Nav-pills
- Scrollbar 自定义样式
- 登录页专属双栏布局（cm-login-*）

### 5.2 layout.html 重构要点

- 顶部导航：`cm-topbar` 深色玻璃态导航
- 品牌区：图标（cm-brand-mark）+ 标题 + 副标题
- 云平台切换：标签式导航（OCI Panel / Azure Panel / AWS Panel）
- IP 白名单 chip：`cm-ip-chip`（点击调用 confirmAddWhitelist）
- 未改动：所有链接 href、url_for 路由、session 变量、JS 函数

### 5.3 各页面重构状态

| 页面 | 重构状态 | 关键保留项 |
|------|----------|-----------|
| login.html | ✅ 完成 | 表单 name/id、MFA 逻辑、提交流程 |
| layout.html | ✅ 完成 | 所有路由链接、session 变量 |
| aws.html | ✅ 完成 | 按钮id、表单id、tbody id、弹窗逻辑 |
| azure.html | ✅ 完成 | createVmModal、editAccountModal字段 |
| oci.html | ✅ 完成（含多轮修复） | 所有 modal id、tbody id、JS 绑定点 |
| mfa_setup.html | 未变动（沿用原版） | — |

---

## 六、各 Blueprint 改动详情

### 6.1 blueprints/aws_panel.py

**改动极少，与原始版基本一致。**

主要功能：
- EC2 / Lightsail 双实例管理
- 账户存储：`key.txt`（明文，`name----access_key----secret_key` 格式）
- 任务日志：内存 `task_logs` dict + queue（非 Celery，使用 threading）
- 分页支持：`/api/accounts?page=&limit=`
- 支持操作：启动/停止/重启/删除/换IP/激活区域/查询所有区域实例

**注意**：AWS 模块使用 threading 而非 Celery 异步任务，与 Azure/OCI 不同。

### 6.2 blueprints/azure_panel.py

**核心改动：Celery 导入来源变更**

```python
# 原始版
from app import celery  # 导致循环导入

# 修改版
from extensions import celery  # 已修复
```

Celery 任务列表：
- `_vm_action_task`：启动/停止/重启/删除 VM
- `_change_ip_task`：更换 VM 公网 IP + 自动检查 SSH NSG 规则
- `_create_vm_task`：完整创建 VM（VNet→PIP→NSG→NIC→VM）

数据存储：
- 账户信息：`azure_keys.json`
- 任务状态：`azure_tasks.db`（SQLite）
- 字段：`id / status / result`

### 6.3 blueprints/oci_panel.py

**改动最多，功能最复杂。**

**Celery 导入来源变更（同 azure）：**
```python
from extensions import celery
```

**新增功能（修改版相较原始版）：**

1. **代理支持（Proxy）**  
   OCI 客户端创建时，若 profile 配置了 `proxy` 字段，强制注入到底层 requests session：
   ```python
   client_obj.base_client.session.proxies = proxies
   ```

2. **多 IP 展示**  
   实例列表支持展示多个私有 IP 对应的公网 IP（次要 IP 通过 `GetPublicIpByPrivateIpIdDetails` 查询）

3. **次要 IP 管理**  
   - `POST /api/instance/add-secondary-ip`：创建私有 IP + 申请公网 IP + 生成 netplan 配置命令
   - `POST /api/instance/delete-secondary-ip`：删除次要私有 IP

4. **IPv6 管理增强**  
   - `POST /api/instance/delete-ipv6`：删除 IPv6
   - ASSIGNIPV6 操作：先删除现有 IPv6 再重新分配（实现"换 IPv6"逻辑）

5. **默认开机脚本（服务端）**  
   - `GET/POST /api/default-script`：管理 `default_startup_script.sh`
   - 创建实例时若前端未传脚本，自动读取服务端默认脚本

6. **操作系统版本查询优化**  
   - 放弃全量翻页查询，改为 `limit=50` 取最新镜像
   - 过滤逻辑：只取匹配 `^\d+\.\d+$` 格式的版本，返回最新2个

7. **实例规格查询优化**  
   - 通过 `list_image_shape_compatibility_entries` 获取指定镜像的兼容规格
   - 只保留 Ampere/AMD 处理器的 VM.* 规格

8. **signal.SIGALRM 线程安全修复**  
   ```python
   if threading.current_thread() is not threading.main_thread():
       return f(*args, **kwargs)
   ```

9. **自动开放防火墙**  
   抢占成功后自动调用 `_auto_open_firewall()`，检查并添加"允许所有流量"的入站/出站规则

10. **租户注册日期缓存**  
    - 首次连接时异步后台获取并写入 `oci_profiles.json`
    - GET /api/profiles 返回时附带 `days_elapsed`（已使用天数）

11. **Cloudflare DNS 自动更新**  
    - 更换 IP / 分配 IPv6 / 抢占成功 → 自动更新 DNS 记录
    - 支持 A 记录（IPv4）和 AAAA 记录（IPv6）

数据存储文件：
| 文件 | 内容 |
|------|------|
| oci_profiles.json | 账号配置（含 proxy/ssh 公钥/注册日期/subnet） |
| oci_tasks.db | 任务状态（SQLite，WAL模式） |
| tg_settings.json | TG Bot 配置 |
| cloudflare_settings.json | Cloudflare API 配置 |
| xui_settings.json | X-UI 管理器配置 |
| default_key.json | 全局默认 SSH 公钥 |
| default_startup_script.sh | 服务端默认开机脚本 |

### 6.4 blueprints/api_bp.py

**Celery 导入来源变更（同 azure/oci）：**
```python
from extensions import celery
```

API 鉴权：Bearer Token，对比 `config.json` 中的 `api_secret_key`

对外暴露接口（前缀：`/api/v1/oci`）：
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /status | 健康检查 |
| GET | /profiles | 获取所有 OCI 账户列表（有序） |
| GET | /{alias}/instances | 获取指定账户实例列表 |
| POST | /{alias}/instance-action | 执行实例操作 |
| POST | /{alias}/snatch-instance | 提交抢占任务 |
| GET | /task-status/{task_id} | 查询任务状态 |
| GET | /tasks/snatch/running | 获取运行中的抢占任务 |
| GET | /tasks/snatch/completed | 获取已完成的抢占任务 |

---

## 七、OCI 页面重构关键记忆点（高风险区域）

### 7.1 oci.html 结构变化

原始版：传统 Bootstrap 多区域平铺
修改版：改为入口型弹窗架构
- `OCI Profiles` → 弹出 Hub 窗口管理账号列表
- `Snatch Queue` → 弹出任务管理弹窗
- `网络与配置` → 弹出网络 Hub，再分Cloudflare/TG/安全规则子弹窗
- 主页面：仅显示"当前连接账户"详情 + 实例列表

### 7.2 oci_script.js 关键约定

已挂载到 window 的函数（供模板层桥接调用）：
- `window.loadSnatchTasks()`
- `window.pollTaskStatus(task_id, isSnatch)`
- `window.addSnatchLog(task_id, message)`
- `window.loadAndDisplayOS()`
- `window.updateAvailableShapes()`

**规则：模板层只调用 window.xxx()，不重写这些函数的实现。**

### 7.3 fallback 机制（oci.html 内联脚本）

当主脚本（oci_script.js）未能在首屏渲染账号列表时：
- 页面 load 后 1.2 秒触发 fallback bootstrap
- 直接请求 `/oci/api/profiles` 渲染账户表格
- 若检测到已有会话，同步渲染"当前连接账户"详情和实例列表
- fallback 渲染的实例行携带 `data-instance-id` / `data-instanceData`，支持选中联动底部操作按钮

### 7.4 "当前连接账户"信息布局（最新版）

采用 4+3+1 行信息栅格：
- 行1（4格）：账户名称 / 租户名 / User / 区域
- 行2（3格）：租户创建时间 / 代理 / SSH 状态
- 行3（1格）：更多信息入口

不显示指纹（已移除）。

---

## 八、已知问题与已解决的历史 Bug

| 问题 | 状态 | 解决方案 |
|------|------|---------|
| Celery 循环导入（app.py ↔ blueprint） | ✅ 已解决 | 抽离 extensions.py |
| extensions.py 被误建到嵌套路径 | ✅ 已解决 | 在根目录重建 |
| Redis 不可用时登录页 500 | ✅ 已解决 | is_redis_available() 降级保护 |
| ui_theme.css 缺失导致样式错乱 | ✅ 已解决 | 补回 static/ui_theme.css |
| SIGALRM 在非主线程 ValueError | ✅ 已解决 | 主线程判断 bypass |
| Bootstrap modal 无法点击/关闭 | ✅ 已解决 | 移除 main/container z-index 提升 |
| OCI 账号列表偶发空白 | ✅ 已解决（含兜底） | fallback 1.2s bootstrap |
| oci_script.js 文件尾部残缺 | ✅ 已解决 | 补回收尾代码与初始化调用 |
| 抢占任务弹窗注入正则跨行语法错误 | ✅ 已解决 | 修复 replace() 语法 |
| 抢占任务 fallback 与原脚本冲突 | ✅ 已解决 | 回退为最小桥接，只调用 window.xxx |
| 网络安全规则管理 fallback 冲突 | ✅ 已解决 | 直接在模板内实现最小 fallback |
| OCI 换 IPv6 不删除旧地址 | ✅ 已解决 | ASSIGNIPV6 先删后建 |
| Oracle IPv6 造成 APT 下载卡死 | ✅ 已解决 | cloud-init 强制 IPv4 hosts 注入 |

---

## 九、待完成 / 下一阶段建议

1. **运行态联调验证**（最高优先级）
   - 逐页点击 AWS / Azure / OCI 主要按钮
   - 验证弹窗打开、表格渲染、选中联动
   - 验证创建实例、抢占任务完整流程

2. **OCI 页面精修**
   - oci_script.js 动态插入的 `bg-light` 任务卡片样式适配深色主题
   - 抢占任务弹窗实时日志链路最终联调

3. **Users/ 目录清理**
   - 根目录存在疑似误建的 `Users/` 目录，确认内容后删除

4. **mfa_setup.html 主题同步**
   - 目前该页面未做深色主题重构，视觉上与其他页面不一致

5. **Azure / OCI 视觉一致性最终确认**
   - 建议用真实页面确认按钮态、选中态、弹窗内容态

---

## 十、配置文件与数据文件清单

| 文件 | 用途 | 格式 |
|------|------|------|
| config.json | API 密钥、IP 白名单 | JSON |
| mfa_secret.json | MFA TOTP 密钥 | JSON |
| key.txt | AWS 账号存储 | 文本（----分隔） |
| azure_keys.json | Azure 账号存储 | JSON 数组 |
| oci_profiles.json | OCI 账号配置 + 排序 | JSON（profiles + profile_order） |
| azure_tasks.db | Azure 任务状态 | SQLite |
| oci_tasks.db | OCI 任务状态（WAL模式） | SQLite |
| tg_settings.json | TG Bot 配置 | JSON |
| cloudflare_settings.json | Cloudflare API 配置 | JSON |
| xui_settings.json | X-UI 对接配置 | JSON |
| default_key.json | 全局默认 SSH 公钥 | JSON |
| default_startup_script.sh | 服务端默认开机脚本 | Shell |

---

## 十一、重要架构约定（后续开发必须遵守）

1. **不得在 blueprint 中直接 `from app import celery`**，必须用 `from extensions import celery`
2. **不得在模板层重写 oci_script.js 中已定义的函数**，只能通过 `window.xxx()` 调用
3. **不得修改现有 DOM id**（`tbody id`、`modal id`、`button id`），JS 绑定依赖这些 id
4. **所有 Redis 操作前必须调用 `is_redis_available()`**，不得直接操作 redis_client
5. **OCI 账号数据结构**：`{ "profiles": {...}, "profile_order": [...] }`，不得简化为平铺 dict
6. **fallback 脚本安全基线**：任何模板内脚本改动必须包裹 try/catch，避免阻断账户列表渲染