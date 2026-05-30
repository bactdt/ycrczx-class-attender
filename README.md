## Class Attender（Chrome / Edge 扩展）

在课程详情页注入“继续学习”和“批量打卡”按钮；在播放页自动点击播放、静音并顺序续学。

### 与原版差异
本仓库基于 `cxl086/ycrczx-class-attender` 调整，当前版本为 `1.0.12`。相对原版主要差异如下：

- 新增适配 `https://ycrczx.com/*` 和 `https://yctc.ycrczx.com/*`，课程详情页和播放页会在这些域名下注入脚本。
- 保留原 `https://www.ycrczx.com/*` 支持，原站点仍可使用。
- 调整打包脚本，生成的 `dist/class-attender.zip` 会把 `manifest.json` 放在 ZIP 根目录，适合 Edge / Chromium 扩展包结构。
- 仓库内附带已打包文件 `dist/class-attender.zip`，可下载后解压加载，或用于扩展后台上传。
- 自动处理播放页“播放完成/学习完成”等提示弹框，避免需要手动点击“确定”。
- 视频结束后会暂停强制续播原视频，并增强“下一节”按钮、`kps(id,classId)` 课时入口和课程详情页目录解析，减少停留在原视频末尾且无法进入下一节的问题。
- 倍速控件扩展为状态面板，展示当前课程、当前/下一课时、解析到的目录和最近执行日志。
- 学习中心页新增课程面板，监听 `getClassNameDataQh` 返回结果，解析未完成课程并支持打开第一门或批量打开未完成课程。
- 学习中心捕获到的未完成课程会保存为队列；打开课程或跨课程续学时，会优先进入该课程第一个未完成课时，而不是从第一节重刷。
- 课程详情页提供两个入口：“继续学习”只打开一个未完成课时；“批量打卡”最多打开 5 个未完成课时。

### 1. 重要声明
- 本项目仅供学习研究使用，不得用于任何商业化用途。
- 如本项目内容侵犯了您的合法权益，请联系我处理（见下方“联系我们”）。

### 2. 联系我们
- 在项目中提交 Issue 说明情况

### 3. 功能概述
- 课程详情页（`https://ycrczx.com/zzpx/courseDetail/{id}`、`https://www.ycrczx.com/zzpx/courseDetail/{id}`、`https://yctc.ycrczx.com/zzpx/courseDetail/{id}`）：
  - 页面右下角注入“继续学习”和“批量打卡(最多5个)”按钮。
  - 点击后优先打开第一个未完成课时；若无法判断进度，则打开第一个可识别课时。
  - 批量打卡最多并发打开 5 个未完成课时，避免一次弹出过多窗口。
- 播放页（`https://ycrczx.com/video/courseLearnPage?id=...&&classId=...`、`https://www.ycrczx.com/video/courseLearnPage?id=...&&classId=...`、`https://yctc.ycrczx.com/video/courseLearnPage?id=...&&classId=...`）：
  - 自动点击 `.vjs-big-play-button` 开始播放。
  - 强制播放：直接调用 `video.play()`；并在自动播放策略下将 `muted=true`、`volume=0`。
  - 静音双保险：静音标签页 + 静音页面中所有 `video` 元素。
  - 进度保活：每 5 秒尝试一次 `video.play()`，避免进度卡住。
  - 自动下一节：在视频结束后优先点击常见“下一节/下一集”按钮，若未找到则基于文本“下一”做回退匹配。
  - 自动确认播放完成类弹框：覆盖原生 `alert/confirm`，并尝试点击页面自定义弹窗中的“确定/确认/知道了”。
  - 结束后跳转保护：视频已结束时不再强制播放原视频；若播放页找不到下一节入口，会根据 `classId` 拉取课程详情页并解析 `kps(id,classId)` 目录来跳转下一课时。
  - 状态面板：在倍速控件中显示课程信息、课时目录和自动播放/弹框处理/下一节跳转日志。
  - 跨课程续学：若当前课程已到最后一课时，会读取学习中心保存的未完成课程队列，自动进入下一门课程的第一个未完成课时。
- 学习中心页（`https://ycrczx.com/studyCenter/page` 等）：
  - 监听站点自己的课程列表接口返回，解析课程名称、进度、课程入口。
  - 面板提供“读取当前列表”“打开第一门未完成”“批量打开未完成”。

### 4. 安装与加载
#### 4.1 前置要求
- Microsoft Edge 或 Chrome 114+（Manifest V3）。
- 已开启“开发人员模式”：Edge / Chrome → 扩展程序 → 右上角“开发人员模式”。

#### 4.2 方式一：加载已解压的扩展（推荐调试）
1. 下载/克隆本项目。
2. 打开 `edge://extensions` 或 `chrome://extensions`。
3. 点击“加载解压缩的扩展”。
4. 选择项目根目录，或选择执行 `npm run build` 后生成的 `dist/src` 目录。

#### 4.3 方式二：打包为 ZIP 后再加载
1. 在项目根目录执行：
   ```bash
   npm run build
   ```
2. 生成的压缩包位于：`dist/class-attender.zip`。
3. 解压后，Edge / Chrome → 扩展程序 → 加载解压缩的扩展，选择解压后的目录。

### 5. 使用教程
#### 5.1 登录站点
- 访问 `https://ycrczx.com/`、`https://www.ycrczx.com/` 或 `https://yctc.ycrczx.com/`，保持已登录状态（播放页通常需要登录）。

#### 5.2 在课程详情页继续学习
1. 打开课程详情页，例如：`https://ycrczx.com/zzpx/courseDetail/2929`、`https://www.ycrczx.com/zzpx/courseDetail/4835` 或 `https://yctc.ycrczx.com/zzpx/courseDetail/4835`。
2. 页面右下角出现“继续学习”和“批量打卡(最多5个)”按钮。
3. 点击“继续学习”：
   - 优先打开第一个未完成课时；
   - 若没匹配到进度信息，则打开第一个可识别的课时播放页。
4. 如弹窗被浏览器拦截，请在地址栏右侧允许此站点的弹窗。

#### 5.3 在播放页自动播放与静音
- 打开的播放页会自动：
  - 静音当前标签页；
  - 点击播放按钮并调用 `video.play()` 强制播放；
  - 若进度不动，会每 5 秒保活一次播放；
  - 遇到播放完成或学习完成弹框时自动确认；
  - 视频结束后尝试自动进入下一节（若页面没有“下一节”按钮，可能无法自动跳转）。

### 6. 常见问题（FAQ）
- 看不到“继续学习”按钮？
  - 刷新页面，确认 URL 形如 `.../zzpx/courseDetail/{id}`。
  - 确认扩展已加载并启用。
- 点击“继续学习”无反应？
  - 检查浏览器是否拦截了弹窗；在地址栏允许本域名弹窗。
  - 页面目录可能是动态加载，先展开或滚动到课程目录区域再点击。
- 播放页点击播放但进度不动？
  - 扩展会周期性强制 `video.play()`；如仍无效，尝试将标签页切到前台并交互一次（某些站点策略需要用户激活）。
  - 若播放器在 `iframe` 内部，需要额外适配选择器；请反馈页面 DOM 片段以便改进。
- 自动下一节不生效？
  - 不同课程模板按钮命名不同；请提供该页 DOM 结构（或截图中按钮的 HTML），我会增强选择器。

### 7. 权限说明
- `host_permissions`: `https://ycrczx.com/*`、`https://www.ycrczx.com/*`、`https://yctc.ycrczx.com/*`（注入脚本的站点范围）。
- `permissions`: `tabs`, `windows`（静音标签页、在新窗口中打开播放页）。

### 8. 目录结构（关键文件）
```
classAttender/
├─ manifest.json           # 扩展清单（MV3）
├─ background.js           # 后台：静音、创建新窗口
├─ content/
│  ├─ detail.js            # 课程详情页：按钮注入、继续学习
│  ├─ learn.js             # 播放页：自动播放、静音、下一节
│  └─ study_center.js      # 学习中心页：课程列表解析和启动学习
├─ scripts/
│  └─ package.sh           # 打包脚本：生成 dist/class-attender.zip
├─ dist/
│  └─ class-attender.zip   # 已打包扩展文件
├─ package.json            # npm 脚本（build/zip）
└─ README.md               # 本说明文档
```

### 9. 开发与调试
- 修改内容脚本后，在扩展页点击“重新加载”，并刷新目标页面。
- 如需打印调试信息，可在脚本中添加 `console.log`，并在页面 DevTools 查看。

---
再次提示：本项目仅供学习研究使用，不得商业化；如有侵权，请联系我处理。

### 10. 协议
- 本项目采用 CC BY-NC 4.0（署名-非商业性使用 4.0 国际）协议授权。
- 详情参见项目根目录的 `LICENSE` 文件。
- 协议链接：
  - 英文法律文本：`https://creativecommons.org/licenses/by-nc/4.0/legalcode`
  - 中文介绍（非官方译文）：`https://creativecommons.org/licenses/by-nc/4.0/deed.zh-Hans`
