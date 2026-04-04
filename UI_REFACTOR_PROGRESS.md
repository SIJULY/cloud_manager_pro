# Cloud Manager UI 重构进度记录

## 已完成
- 建立全局主题文件：`static/ui_theme.css`
- 重构全局骨架：`templates/layout.html`
- 重构登录页：`templates/login.html`
- 重构 AWS 页面：`templates/aws.html`
- 重构 Azure 页面：`templates/azure.html`
- 重构 OCI 页面：`templates/oci.html`

## 本轮改动摘要
### 全局主题
- 引入深色科技风主题变量
- 统一背景、卡片、表格、表单、按钮、弹窗、标签、导航样式
- 增加玻璃态/发光/深色控制台风格基础视觉

### Layout
- 顶部导航改为科技控制台风格 Header
- 品牌区升级为图标 + 标题 + 副标题
- 云平台切换改为更强视觉标签式导航
- 登录 IP 白名单入口改为安全状态 chip 风格
- 不改任何链接、接口与功能行为

### Login
- 改为双栏深色科技登录页
- 左侧展示品牌说明与平台能力
- 右侧保留原登录/MFA 提交流程
- 不改表单字段、name、id、提交逻辑

### AWS
- 改为接近控制中心的 Hero + 状态卡 + 主工作区布局
- 重构账户录入、账户列表、操作区、实例列表、日志区视觉层级
- 保留原有所有按钮 id、表单 id、表格 tbody id、分页与弹窗逻辑
- User Data、实例操作、区域查询逻辑均未改动，仅升级布局与视觉

### Azure
- 改为与 AWS 一致的深色科技控制台骨架
- 重构 Azure 账户区、操作区、虚拟机列表、日志区视觉层级
- 保留账户添加、区域选择、创建 VM、刷新列表、实例操作、日志等原有功能逻辑
- `createVmModal` 与 `editAccountModal` 功能和字段保持不变，仅承接全局深色主题

### OCI
- 完成主页面重构：Hero、状态卡、账户区、操作区、实例区、日志区统一为深色科技控制台风格
- 保留所有账户管理、抢占任务、网络设置、Cloudflare、TG/API、实例生命周期等功能逻辑与关键 id
- 对复杂弹窗的局部浅色块、日志块、表格容器做深色主题兼容处理
- 未修改接口、按钮行为、表单字段、tbody id、modal id，仅升级布局与视觉

## 下一阶段建议
1. 先完成运行态联调并修复启动期问题，再逐页点击 AWS / Azure / OCI 的主要按钮、弹窗与表格选择流程
2. 重点修正 OCI 页面中脚本动态生成的浅色块、日志块和任务卡片样式
3. 根据实际浏览器渲染结果处理极少数局部按钮/表头/辅助面板的主题残留

## 风险备注
- 页面模板后续重构时，必须保留现有 DOM id 供 JS 正常绑定
- OCI 页面功能密度最高，虽然已完成主重构，但仍最需要联动验证
- 当前静态巡检已发现 OCI 仍存在少量旧浅色样式残留，且 `static/js/oci_script.js` 里有动态插入 `bg-light` 的任务卡片片段，下一轮需结合实际页面做精修
- Azure / OCI 的最终视觉一致性已做静态复查，但仍建议用真实页面再确认按钮态、选中态与弹窗内容态
- 运行期已发现一个独立问题：`app.py -> blueprints.azure_panel -> app.py` 的 Celery 循环导入，已通过抽离 `extensions.py` 中的共享 Celery 实例修复
- 修复过程中发现 `extensions.py` 被误创建到嵌套路径，现已在项目根目录补齐正确文件，供 `app.py` 直接导入
- 后续继续清理了 `blueprints/oci_panel.py` 中同类循环导入，改为统一从 `extensions.py` 引用共享 Celery 实例
- 运行态联调发现 Redis 虽可初始化对象，但请求时连接被服务端关闭，已在 `app.py` 中增加 `ping()` 预检与运行时降级保护，避免登录页因 Redis 异常直接 500
- 运行态联调进一步发现全局主题文件 `static/ui_theme.css` 实际缺失于静态目录，已补回根目录 `static/ui_theme.css`，修复登录页与整体页面样式错乱问题
- 继续联调时发现 `blueprints/oci_panel.py` 的超时装饰器使用 `signal.SIGALRM`，在非主线程请求中会触发 `signal only works in main thread`；已增加主线程判断，避免 `/oci/api/session` 在 macOS 本地开发环境下 500
- 运行态验证发现弹窗打开后无法点击与关闭，根因是全局主题给 `main` / `.container` / `.container-fluid` 提升了层级，压过了 Bootstrap modal；已移除相关 `z-index`，恢复弹窗与遮罩层交互
- 根据实测反馈继续修正 OCI“查看抢占任务”弹窗：将任务列中动态生成的白色配置块改为 `oci-task-config` 深色样式，统一适配整体主题
- 排查到 OCI 账号列表偶发空白的直接原因是 `static/js/oci_script.js` 文件尾部曾残缺，导致页面初始化逻辑未执行；现已补回批量删除段落后的收尾代码与初始化调用（`loadProfiles()` / `loadAndDisplayDefaultKey()`）
- 按最新 UI 细修要求开始重构 OCI 主工作区：将 `OCI Profiles`、`Snatch Queue`、`网络与配置` 改造成入口型弹出窗口；主页面账户区改为只读的“当前连接账户”详情展示，并移除独立“实例运维”入口卡，保留主页面实例列表及其运维能力
- 第一轮结构改造后联调发现 `static/js/oci_script.js` 文件尾部再次残缺，导致账号连接失效；已补回脚本收尾与初始化调用，并将 OCI 顶部统计卡布局从 4 列调整为 3 列，消除右侧空白卡位
- 按“继续一次性修改完毕”的要求继续完善 OCI 首页：为 3 张入口卡增加动态摘要信息、补充当前连接账户状态徽标、打通 Network Hub 到 Cloudflare / TG&API 弹窗，并让首页摘要随账号/任务/配置状态自动刷新

- 继续第二轮 OCI 精修：统一 Profiles / Snatch / Network / Cloudflare / TG 等弹窗的深色头尾样式，补充入口按钮 hover 反馈、空状态图标化展示，并优化当前连接账户的状态徽标与说明文案

- 按当前需求继续统一 AWS / Azure 顶部视觉：在不改结构与功能的前提下，将两页 Hero 标题卡及首张统计卡主色切换为与 OCI 一致的橙红科技风

- 按最新反馈继续细修 OCI“当前连接账户”区：将原高卡片改为更紧凑的低高度信息栅格，补充账户名、User、租户名/租户ID、区域、代理、创建时间、SSH、公钥、指纹等只读字段，提升首页信息密度

- 根据最新交互反馈修正 OCI 连接联动：账号连接成功后立即执行 `checkSession(true)`，自动同步当前连接账户详情与该账户实例列表，无需再手动点击“刷新列表”；同时进一步压缩账户详情卡高度并为长字段增加省略与 title 提示

- 继续修正 OCI 自动初始化：新增 `initializeOciDashboard()` 统一触发账号列表、默认 SSH 与会话状态加载，并在 Profiles Hub 打开时强制刷新列表；同时增加一次 500ms 的兜底重试，避免页面首屏偶发不自动加载账户

- 为彻底兜住 OCI 账号列表首屏不显示问题，在 `templates/oci.html` 追加了一个独立的 inline fallback bootstrap：若主脚本未在首屏渲染出账号列表，则在页面 load 后 1.2 秒直接调用 `/oci/api/profiles` 与 `/oci/api/session` 渲染账户表，并提供最基础的连接刷新能力

- 继续补强 OCI fallback：当账号列表由内联兜底脚本渲染时，若检测到已有登录会话，则同步补绘“当前连接账户”详情与实例列表，避免仅显示账户管理而主面板仍为空

- 按最新要求仅微调 OCI“当前连接账户”区：取消显示“指纹”，改为 4+3+1 行的信息布局（账户名称 / 租户名 / User / 区域；租户创建时间 / 代理 / SSH；更多信息），并补回首页“断开连接”按钮事件，确保断开后刷新页面状态；同时保留“创建 / 抢占实例”按钮的模态触发能力

- 本轮继续修复 OCI 首页 fallback 接管后的缺失能力：真正替换“当前连接账户”布局并移除指纹展示；为抢占任务弹窗补上任务列表兜底加载；为“网络与配置”三个入口补上独立弹窗/配置加载兜底；为 fallback 渲染的实例列表补充 `data-instance-id` / `data-instanceData` 与可点击选中能力，恢复底部实例操作按钮联动

- 继续修补 OCI fallback 接管后的细节缺口：抢占任务弹窗增加 5 秒轮询与“实时任务日志”兜底输出；网络安全规则管理入口改为先拉取 `/oci/api/network/resources` 与安全列表详情再打开 modal；删除实例列表右上角重复的“网络设置”按钮；为 fallback 渲染实例列表补充选中态与底部实例操作按钮启用逻辑

- 根据最新要求回归“原项目行为优先”：撤掉对抢占任务弹窗与网络安全规则管理的自定义 fallback 交互实现，不再自行改写其 UI/轮询逻辑；改为仅保留最小兼容桥接——“网络与配置 -> 网络安全规则管理”通过隐藏触发器复用原 `networkSettingsBtn` / `networkSettingsModal` 初始化链，确保后续行为与原 `static/js/oci_script.js` 一致

- 本轮补回 OCI 首页在原脚本部分失效后的兼容层：恢复“抢占任务管理”弹窗任务列表/双击结果/批量暂停恢复删除/全选联动；恢复“网络与配置”三个入口及网络安全规则管理的 VCN / 安全列表 / 规则加载、增删规则、一键开放、防火墙保存；恢复 fallback 实例列表选中后底部实例操作按钮的确认与请求提交链路，并保留隐藏桥接入口避免页面重复按钮

- 紧急修正：为模板内 OCI 兼容层增加顶层 `try/catch` 保护，避免兼容逻辑初始化异常时阻断账户列表 fallback 渲染；同时升级静态版本号，优先恢复“账户管理可加载”这一基础可测状态

- 紧急回退：移除模板中新增的 OCI 兼容层脚本，仅保留账户列表/当前连接账户/实例列表的 fallback 基础渲染与最小桥接，优先恢复账户管理显示，后续再逐项重新接回抢占任务、网络与实例操作功能

- 在保持“账户列表可显示”安全基线前提下，仅重新接回“网络与配置”三个入口的最小桥接：网络安全规则管理复用隐藏 `networkSettingsBtn` 触发原脚本链路；Cloudflare / TG & API 入口使用只读配置拉取 + 原 modal 打开方式恢复基础可用，暂不再次引入整块兼容层

- 继续仅修“网络安全规则管理”：不再依赖原脚本里失效的入口链，改为模板最小 fallback 直接完成 VCN / 安全列表 / 规则加载、添加入站/出站规则、一键开放、防火墙规则保存；Cloudflare / TG & API 保持已恢复状态

- 补强“网络安全规则管理 -> 一键开放防火墙”交互反馈：添加后会明确给出提示，说明已插入允许所有规则且仍需点击“保存更改”才会真正生效，避免用户误以为按钮无反应

- 为“网络安全规则管理 -> 一键开放防火墙”增加强提示兜底：点击后直接 `alert` 当前结果，并短暂点亮 loading spinner，确保在日志面板不可见时用户也能明确感知按钮已执行

- 开始修复“抢占任务管理”弹窗全部功能：模板内补回最小 fallback 链路，恢复任务列表加载、运行/完成 tab 状态切换、全选/多选联动、暂停/恢复/删除、双击查看结果、日志清空与弹窗打开后的滚动定位；不影响已稳定的账户列表与网络配置模块

- 紧急修正：抢占任务 fallback 注入时把 `String(message).replace(/\n/g, ...)` 意外写坏成跨行正则，导致模板内脚本语法错误并再次阻断账户列表渲染；现已修复该语法点并提升静态版本，优先恢复“账户管理可显示”的安全基线

- 继续修复抢占任务弹窗中的“实时任务日志”：补回最小轮询链路，弹窗打开后定时读取 running 任务摘要并写入日志区，关闭弹窗停止轮询；避免依赖原脚本中未完全接通的 snatch poller 链导致日志面板始终空白

- 按用户要求回退：移除模板中对“抢占任务管理”新增的 fallback 日志/轮询/任务操作接管逻辑，不再用数据库摘要模拟实时日志；后续改为重新对齐原始 `oci_script.js` 的 `pollTaskStatus -> handleSnatchTaskPolling -> addSnatchLog` 设定，只做桥接不自创实现

- 按“必须遵循原始脚本”原则，直接修补 `static/js/oci_script.js` 的原生抢占任务链路：1) 抢占任务弹窗 `shown.bs.modal` 时也执行原始 `loadSnatchTasks()`；2) 在 `loadSnatchTasks()` 中对 running 任务重新打开弹窗时，先清掉旧 poller 与 `lastSnatchLog_*` 再重新 `pollTaskStatus(task.id, true)`，避免旧定时器残留导致实时日志不再刷新

- 紧急回退一处对原始抢占任务脚本的误改：恢复 `shown.bs.modal` 仅滚动日志、不在该钩子里重复调用 `loadSnatchTasks()`；恢复 `loadSnatchTasks()` 中原来的 `!window.taskPollers[task.id]` 判断，避免弹窗展示阶段再次打断原有任务轮询，先回到“弹窗至少可显示原始列表”的稳定状态

- 继续按原始脚本逻辑桥接抢占任务列表显示：不碰实时日志/poller，只在模板内补回与原 `loadSnatchTasks()` 等价的列表渲染与弹窗初始 tab 状态切换，目标先恢复 `/oci/api/tasks/snatching/running|completed` 的前端展示，再单独排实时日志链路

- 在不改原始日志实现的前提下继续桥接：抢占任务列表桥接加载成功后，若发现 running 任务且原始 `window.pollTaskStatus` 可用，则直接调用原始 `pollTaskStatus(task.id, true)` 重新挂回实时日志链；仍不改 `handleSnatchTaskPolling` / `addSnatchLog` 本身

- 按用户要求落地修正：删除模板中的抢占任务 bridge 代码，避免再由模板接管列表/日志逻辑；改为把 `static/js/oci_script.js` 里的原始 `addSnatchLog` / `pollTaskStatus` / `loadSnatchTasks` 挂到 `window`，确保当前页面其他脚本只能调用原始实现本身

- 继续按原始实现落地：模板层不再自定义列表渲染，只负责在点击“抢占任务”按钮时调用已挂到 `window` 的原始 `loadSnatchTasks()`，并同步原始 tab/按钮显示状态，确保真正执行的是 `static/js/oci_script.js` 里的原始抢占任务入口

- 继续严格按原始脚本入口修复创建/抢占实例弹窗：把 `loadAndDisplayOS` 与 `updateAvailableShapes` 也挂到 `window`，并在模板层仅负责于 modal `show.bs.modal` 时调用原始 `window.loadAndDisplayOS()`、在 `instanceOS change` 时调用原始 `window.updateAvailableShapes()`，不自行改写操作系统/规格加载逻辑
