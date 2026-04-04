# Cloud Manager 修改版项目记忆文件

> 本文件由 AI 自动生成，用于记录修改版项目的关键信息，供后续对话持续参考。
> 路径：/Users/xiaolongnvtaba/Downloads/cloud_manager-main/PROJECT_MEMORY.md

---

## 一、项目基本信息

| 项目 | 路径 |
|------|------|
| 原始项目 | /Users/xiaolongnvtaba/Downloads/cloudmanager |
| 修改版项目 | /Users/xiaolongnvtaba/Downloads/cloud_manager-main |

---

## 二、修改版项目目录结构

```
cloud_manager-main/
├── app.py                        # Flask 主入口（已修改）
├── extensions.py                 # ✨新增：共享 Celery 实例（解决循环导入）
├── blueprints/
│   ├── aws_panel.py              # AWS 蓝图（基本与原始一致）
│   ├── azure_panel.py            # Azure 蓝图（Celery 任务改为从 extensions 引入）
│   ├── oci_panel.py              # OCI 蓝图（功能最复杂，已大量修改）
│   └── api_bp.py                 # TGBot API 蓝图（已修改支持新 profiles 结构）
├── templates/
│   ├── layout.html               # ✨已重构：深色科技控制台顶部导航
│   ├── login.html                # ✨已重构：双栏深色科技登录页
│   ├── aws.html                  # ✨已重构：深色科技风控制台布局
│   ├── azure.html                # ✨已重构：深色科技风控制台布局
│   ├── oci.html                  # ✨已重构（最复杂）：含大量 fallback 与桥接逻辑
│   └── mfa_setup.html            # MFA 绑定页（未明确说明是否修改）
├── static/
│   ├── ui_theme.css              # ✨新增：全局深色科技主题样式
│   └── js/
│       ├── aws_script.js         # AWS 前端逻辑（未明确修改）
│       ├── azure_script.js       # Azure 前端逻辑（未明确修改）
│       └── oci_script.js         # OCI 前端逻辑（已修改：关键函数挂到 window）
├── Dockerfile
├── docker-compose.yml
├── Caddyfile
├── install.sh
├── docker-install.sh
├── install_tgbot.sh
├── .env.example
├── README.md
├── UI_REFACTOR_PROGRESS.md       # ✨新增：UI 重构进度记录文件
└── PROJECT_MEMORY.md             # ✨本文件
```

---

## 三、原始项目 vs 修改版项目 核心差异

### 1. app.py 差异

| 项目 | 原始版 | 修改版 |
|------|--------|--------|
| Celery 初始化 | 直接在 app.py 内 `celery = Celery(app.name, ...)` | 抽离到 `extensions.py`，通过 `init_celery(app)` 初始化 |
| Redis 检查 | 只做 `from_url`，不 ping | 增加 `redis_client.ping()` 预检，失败则降级 |
| Redis 使用 | 直接用 `if not redis_client` | 增加 `is_redis_available()` 函数做运行时安全检查 |
| 监听端口 | 5000 | 5001 |
| 导入方式 | `from celery import Celery` 直接在 app.py 使用 | `from extensions import celery, init_celery` |

### 2. extensions.py（新增文件）

```python
from celery import Celery
celery = Celery(__name__)

def init_celery(app):
    celery.conf.update(
        broker_url=app.config['broker_url'],
        result_backend=app.config['result_backend'],
        broker_connection_retry_on_startup=...
    )
    return celery
```

**作用**：解决 `app.py -> azure_panel -> app.py` 的 Celery 循环导入问题。

### 3. blueprints/azure_panel.py 差异

- 原始版：从 `app.py` 导入 celery（造成循环导入）
- 修改版：`from extensions import celery`

### 4. blueprints/oci_panel.py 差异

- 原始版：从 `app.py` 导入 celery（循环导入）
- 修改版：`from extensions import celery`
- 新增功能：
  - 代理支持（proxy 注入到 OCI SDK 底层 session）
  - 多私有IP / IPv6 管理
  - 默认开机脚本文件 `default_startup_script.sh` 的读写 API
  - 自动开放防火墙 `_auto_open_firewall()`
  - 租户注册日期后台自动获取 `_internal_fetch_and_save_tenancy_date()`
  - `signal.SIGALRM` 在非主线程的保护（macOS 开发环境兼容）
  - `recover_snatching_tasks()` 服务重启后自动恢复抢占任务
  - X-UI 对接配置（`xui_settings.json`）
  - 抢占任务支持环境变量注入（MAIN_DOMAIN / IS_DOMAIN_BOUND / MANAGER_URL / AUTO_REG_SECRET）

### 5. blueprints/api_bp.py 差异

- 原始版结构：profiles 是扁平 dict
- 修改版：支持新的 `{"profiles": {...}, "profile_order": [...]}` 结构
- 接口 `/profiles` 已修正为返回有序账户名列表

### 6. static/ui_theme.css（新增文件）

- 全局深色科技风主题
- CSS 变量体系（`--cm-bg`, `--cm-primary`, `--cm-surface` 等）
- 覆盖 Bootstrap 所有组件：卡片、表格、表单、按钮、弹窗、导航、标签等
- 玻璃态 / 发光 / 网格背景视觉效果

### 7. templates 整体风格变化

- **layout.html**：科技控制台顶部导航，品牌区图标+标题+副标题，标签式平台切换，IP 白名单 chip
- **login.html**：双栏布局（左侧品牌介绍，右侧登录表单），深色科技风
- **aws.html / azure.html**：Hero + 状态卡 + 主工作区布局，主色改为橙红科技风
- **oci.html**：最复杂，OCI Profiles / Snatch Queue / 网络与配置 改为入口型弹窗，首页展示当前连接账户详情

---

## 四、OCI 数据结构变化（重要）

### profiles.json 结构

**原始版**（扁平 dict）：
```json
{
  "alias1": { "user": "...", "tenancy": "...", ... },
  "alias2": { ... }
}
```

**修改版**（带排序）：
```json
{
  "profiles": {
    "alias1": { "user": "...", "tenancy": "...", "proxy": "...", "registration_date": "2023-01-01", ... },
    "alias2": { ... }
  },
  "profile_order": ["alias1", "alias2"]
}
```

新增字段：
- `proxy`：代理 URL
- `registration_date`：租户注册日期（YYYY-MM-DD）
- `default_ssh_public_key`：账号级默认 SSH 公钥
- `default_subnet_ocid`：自动发现或创建的子网 OCID

---

## 五、OCI 任务数据库（oci_tasks.db）

表结构：
```sql
CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    type TEXT,           -- 'snatch' / 'action'
    name TEXT,
    status TEXT NOT NULL, -- 'pending' / 'running' / 'paused' / 'success' / 'failure'
    result TEXT,
    created_at TEXT,
    account_alias TEXT,
    completed_at TEXT    -- 后期 schema 升级添加
);
```

任务 result 字段（snatch 任务）为 JSON 字符串：
```json
{
  "details": { "shape": "...", "ocpus": 4, "display_name_prefix": "...", ... },
  "attempt_count": 12,
  "last_message": "在 AD-1 中资源不足，将在 45 秒后重试...",
  "start_time": "2024-01-01T00:00:00+00:00",
  "run_id": "uuid-xxx"
}
```

---

## 六、配置文件清单

| 文件名 | 用途 |
|--------|------|
| `config.json` | API 密钥、IP 白名单 |
| `mfa_secret.json` | MFA TOTP 密钥 |
| `oci_profiles.json` | OCI 账号信息（含排序） |
| `default_key.json` | 全局默认 SSH 公钥 |
| `default_startup_script.sh` | 服务器端默认开机脚本 |
| `tg_settings.json` | Telegram Bot Token & Chat ID |
| `cloudflare_settings.json` | Cloudflare API Token / Zone ID / Domain |
| `xui_settings.json` | X-UI 管理面板对接 URL & Secret |
| `azure_keys.json` | Azure 账号信息 |
| `key.txt` | AWS 账号信息（name----ak----sk 格式） |
| `azure_tasks.db` | Azure 任务数据库 |
| `oci_tasks.db` | OCI 任务数据库 |

---

## 七、已知问题与修复记录（来自 UI_REFACTOR_PROGRESS.md）

1. **循环导入**：`app.py -> azure_panel -> app.py` 的 Celery 循环导入，通过 `extensions.py` 修复
2. **Redis 500**：Redis 对象可初始化但运行时连接断开，导致登录页 500，已增加 ping 预检和降级保护
3. **ui_theme.css 缺失**：主题文件未被正确放到 static 目录，已补回
4. **SIGALRM 非主线程报错**：OCI panel 超时装饰器在非主线程（macOS 开发环境）报错，已增加主线程判断
5. **弹窗层级被压**：全局主题 z-index 压过 Bootstrap modal，已移除相关 z-index
6. **OCI 账号列表偶发空白**：`oci_script.js` 文件尾部残缺导致初始化未执行，已补回
7. **OCI 抢占任务实时日志**：原始脚本 poller 链路问题，最终方案是将 `addSnatchLog / pollTaskStatus / loadSnatchTasks` 挂到 `window`，模板层只做最小桥接

---

## 八、oci_script.js 关键设计

- 所有核心函数挂到 `window`：
  - `window.addSnatchLog`
  - `window.pollTaskStatus`
  - `window.loadSnatchTasks`
  - `window.loadAndDisplayOS`
  - `window.updateAvailableShapes`
- 模板层（`oci.html`）只做桥接，不自行实现业务逻辑
- `initializeOciDashboard()` 统一初始化入口，页面加载时自动执行

---

## 九、UI 主题色彩规范

| 变量 | 值 | 用途 |
|------|----|------|
| `--cm-bg` | `#0b1220` | 页面背景 |
| `--cm-primary` | `#6366f1` | 主色（紫蓝） |
| `--cm-primary-2` | `#8b5cf6` | 主色渐变 |
| `--cm-success` | `#10b981` | 成功绿 |
| `--cm-danger` | `#ef4444` | 危险红 |
| `--cm-warning` | `#f59e0b` | 警告橙 |
| `--cm-info` | `#38bdf8` | 信息蓝 |
| OCI/AWS/Azure Hero 主色 | 橙红科技风 | AWS/Azure 顶部统一为橙红色 |

---

## 十、后续开发注意事项

1. **必须保留 DOM id**：`oci.html` 中所有 `id` 属性供 `oci_script.js` 绑定，不可随意修改
2. **不要在模板层自创业务逻辑**：OCI 的抢占任务、网络管理等逻辑必须走 `oci_script.js` 原始实现
3. **Celery 任务必须从 extensions 导入**：所有蓝图中 `from extensions import celery`
4. **profiles.json 格式**：必须使用带 `profile_order` 的新格式，不能回退到扁平 dict
5. **数据库 schema**：`oci_tasks.db` 的 `tasks` 表含 `completed_at` 字段（后期添加），新部署需确保包含
6. **OCI oci_script.js 尾部完整性**：历史上多次因文件尾部残缺导致初始化失效，修改时需注意保持文件完整
