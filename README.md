# 藝速科技积分系统

参考 `UI.png` 实现的深色响应式管理后台。前端使用 HTML / CSS / JavaScript，日常业务保存在浏览器；可通过 Cloudflare Workers + D1 服务器上传、下载共享备份。

## 本地运行

需要 Node.js 18 或更新版本：

```sh
npm run dev
```

打开 http://localhost:5173 。首次运行自动创建 6 个演示客户，可在「数据备份」中清空客户和流水。请通过 HTTP 服务访问，不能直接双击 index.html（前端使用 ES Modules）。

本地服务器同时提供备份接口，演示密钥为 `local-demo-sync-key-2026`，也可通过 `SYNC_TOKEN` 环境变量覆盖。本地云端备份保存到 `.local-data/cloud-backup.json`，重启服务仍会保留，仅绑定本机地址。该演示密钥不会用于 Cloudflare；生产环境必须单独设置密钥。

## 功能

- 客户新增、编辑、名称/电话/类别筛选、分页、CSV 导出。
- 套餐充值、自定义充值、积分消耗、余额检查、提交确认及流水记录。
- 流水按客户、类型和日期筛选，CSV 导出。
- 套餐与服装类别新增、编辑、删除；使用中的类别不允许删除。
- 系统名称、默认积分兑换比例、低余额阈值设置。
- JSON 完整备份和恢复，导入检查编号、引用、积分及流水余额一致性。
- 浏览器多窗口更新检测，避免旧页面覆盖新数据。
- 手机底部导航、客户和流水卡片、44px 操作按钮、底部表单弹窗与安全区域适配。
- 云端整份备份上传、下载，共享密钥验证，版本冲突保护，下载前保留一份本地恢复副本。
- 清空客户与流水前必须输入清空密码，默认 `88888888`；密码为空或错误时不执行清空。此密码是本地操作确认，与云端共享密钥独立。

积分流水只追加，不提供直接删改，客户档案编辑不会改动已有流水中的历史名称。金额仅记账，不调用支付服务。CSV 是查看用途，迁移数据请使用 JSON 备份。

## 部署到 Cloudflare（默认无需数据库）

当前 `wrangler.jsonc` 不绑定 D1，也不需要设置共享密钥，可以直接部署网页。

在 Cloudflare 创建 Worker 并连接 GitHub 仓库后填写：

- Project name：`factory-customer-points`（与配置文件保持一致）。
- Build command：`npm run build`。
- Deploy command：`npx wrangler deploy`。
- 生产分支：`main`。构建环境使用 Node.js 22 或更新版本。

点击部署即可。客户管理、积分充值/消耗、文件备份和恢复都可使用，数据保存在各设备自己的浏览器中。云端上传/下载暂不可用，也不会跨设备共享数据。需要转移资料时，在原设备导出 JSON 文件，再在另一设备导入。

## 部署到 Cloudflare（可选：启用云端共享）

推荐使用 **Workers 静态资源 + D1**，页面和 `/api/backup` 在同一域名下，无需单独配置接口地址。Wrangler 部署工具请使用 Node.js 22 或更新版本；本地预览仍支持 Node.js 18。

1. 登录并创建 D1 数据库：

```sh
npx wrangler login
npx wrangler d1 create factory-points-backups
```

2. 将 `wrangler.cloud.example.jsonc` 的内容复制到 `wrangler.jsonc`，再将命令返回的 `database_id` 填入其中，替换 `REPLACE_WITH_YOUR_D1_DATABASE_ID`。提交到 GitHub，后续自动部署也会使用此数据库绑定。

3. 初始化数据库表，设置共享密钥，构建并发布：

```sh
npx wrangler d1 migrations apply factory-points-backups --remote
npx wrangler secret put SYNC_TOKEN
npm run check
npm run build
npx wrangler deploy
```

`secret put` 会提示输入密钥，请使用至少 16 位的随机密钥（建议 32 位以上）。将同一个密钥提供给需要共享资料的设备。密钥保存在 Cloudflare Secret 中，不要写入源码。首次创建 Worker 时，按 CLI 提示确认创建，再部署即可。

部署完成后，各设备打开同一 `workers.dev` 地址或绑定的自定义域名。进入「数据备份」，输入密钥并连接。

### 多端操作顺序

1. 第一台设备整理客户资料，点击「上传本机资料」并确认。
2. 第二台设备连接后，点击「下载云端资料」，确认覆盖本机资料。
3. 切换到另一台设备工作前，先在原设备上传；另一台设备下载最新版本后再编辑。
4. 云端版本比本机旧基准更新时，上传会被拒绝。先导出本机 JSON 保存未上传的修改，再下载最新资料；需要保留的变动须手动核对补录，不会自动合并两台设备的流水。

云端存储一份最新的全量备份；同一个部署及其密钥代表同一套共享资料。需要不同工厂独立存储时，应使用不同部署和数据库。共享密钥拥有上传和下载权限，没有细分用户权限。

下载前自动将当前本机资料存到 `factory-before-cloud-restore`，可用「导出下载前的本地资料」取回；下一次下载会替换此副本。如果浏览器空间不足以保存副本，将停止覆盖。重要数据仍应定期导出文件备份。

云端单份请求上限 900 KB，以适应 D1 单行大小限制。超过上限时会提示且不更新云端，可继续使用本地 JSON 文件备份；大量历史流水的场景应扩展为 R2 对象存储或业务表同步。

### 仅部署静态页面

仍可将 `dist` 上传到 Cloudflare Pages（构建命令 `npm run build`，输出 `dist`）。这种方式只具备本地业务和文件备份，**不会部署云端接口**。需要共享资料时请使用上面的完整 Worker 部署流程，不要只上传 `dist`。

## 数据说明

数据存放于当前域名的 localStorage，键为 `factory-points-v1`。不同设备/浏览器不会自动同步，清除站点数据会丢失记录。容量受浏览器限制，存储失败时会提示且不会显示成功。请定期下载备份。

顶部管理员为界面展示，日常操作没有账号登录。启用云端后，只有输入共享密钥的请求可以读取或上传 D1 备份。密钥只放在当前标签页 sessionStorage，不包含在导出的备份里。云端上传是手动操作，浏览器里未上传的改动不会自动同步。字体使用可选的 Google Fonts，无法联网时自动使用系统字体。

## 浏览器测试

```sh
npm ci
npm run test:api
npm test
```

默认使用已安装的 Microsoft Edge 无头浏览器。其他环境可运行 `npx playwright install chromium` 并设置环境变量 `PLAYWRIGHT_CHANNEL=chromium`。测试在 5174 端口启动隔离服务器，备份位于 `test-results/cloud`，不会修改日常浏览器记录或 `.local-data`。

覆盖客户、积分、文件备份、云端密钥校验、两个独立浏览器交换资料、过期版本拒绝、下载前恢复副本、320/390/768px 页面与手机充值流程。API 测试检查鉴权、无效数据、体积限制及并发写入保护。实际 D1 绑定与公网连通性需在完成 Cloudflare 配置后验证。
