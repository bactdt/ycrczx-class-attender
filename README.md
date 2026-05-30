## Class Attender（Chrome 扩展）

在课程详情页注入“批量播放”按钮，批量打开并自动播放课程视频；在播放页自动点击播放并静音标签页。

### 1. 重要声明
- 本项目仅供学习研究使用，不得用于任何商业化用途。
- 如本项目内容侵犯了您的合法权益，请联系我处理（见下方“联系我们”）。

### 2. 联系我们
- 在项目中提交 Issue 说明情况

### 3. 功能概述
- 课程详情页（`https://www.ycrczx.com/zzpx/courseDetail/{id}`、`https://yctc.ycrczx.com/zzpx/courseDetail/{id}`）：
  - 页面右下角注入“批量播放”按钮。
  - 点击后优先逐个点击页面中的 `.section`（等价 `$(".section").each(function(){ $(this).click(); })`）。
  - 若未匹配到 `.section`，则逐个在“新窗口”中打开对应的播放页链接（后台创建窗口，失败时回退至新标签页）。
- 播放页（`https://www.ycrczx.com/video/courseLearnPage?id=...&&classId=...`、`https://yctc.ycrczx.com/video/courseLearnPage?id=...&&classId=...`）：
  - 自动点击 `.vjs-big-play-button` 开始播放。
  - 强制播放：直接调用 `video.play()`；并在自动播放策略下将 `muted=true`、`volume=0`。
  - 静音双保险：静音标签页 + 静音页面中所有 `video` 元素。
  - 进度保活：每 5 秒尝试一次 `video.play()`，避免进度卡住。
  - 自动下一节：在视频结束后优先点击常见“下一节/下一集”按钮，若未找到则基于文本“下一”做回退匹配。

### 4. 安装与加载
#### 4.1 前置要求
- Chrome 114+（Manifest V3）。
- 已开启“开发者模式”：Chrome → 扩展程序 → 右上角“开发者模式”。

#### 4.2 方式一：加载已解压的扩展（推荐调试）
1. 下载/克隆本项目。
2. Chrome → 扩展程序 → 加载已解压的扩展。
3. 选择本项目根目录：`/Users/chenxiaoliang/playground/classAttender`。

#### 4.3 方式二：打包为 ZIP 后再加载
1. 在项目根目录执行：
   ```bash
   npm run build
   ```
2. 生成的压缩包位于：`/Users/chenxiaoliang/playground/classAttender/dist/class-attender.zip`。
3. 解压后，Chrome → 扩展程序 → 加载已解压的扩展，选择解压后的 `dist/src` 目录。

### 5. 使用教程
#### 5.1 登录站点
- 访问 `https://www.ycrczx.com/` 或 `https://yctc.ycrczx.com/`，保持已登录状态（播放页通常需要登录）。

#### 5.2 在课程详情页批量打开
1. 打开课程详情页，例如：`https://www.ycrczx.com/zzpx/courseDetail/4835` 或 `https://yctc.ycrczx.com/zzpx/courseDetail/4835`。
2. 页面右下角出现“批量播放”按钮。
3. 点击“批量播放”：
   - 优先逐个点击 `.section` 项；若站点会自动在新窗口/新标签打开，则会依站点行为执行。
   - 若没匹配到 `.section`，扩展会逐个在新窗口中打开每个课时播放页（做了节流，减少弹窗拦截风险）。
4. 如弹窗被浏览器拦截，请在地址栏右侧允许此站点的弹窗。

#### 5.3 在播放页自动播放与静音
- 打开的播放页会自动：
  - 静音当前标签页；
  - 点击播放按钮并调用 `video.play()` 强制播放；
  - 若进度不动，会每 5 秒保活一次播放；
  - 视频结束后尝试自动进入下一节（若页面没有“下一节”按钮，可能无法自动跳转）。

### 6. 常见问题（FAQ）
- 看不到“批量播放”按钮？
  - 刷新页面，确认 URL 形如 `.../zzpx/courseDetail/{id}`。
  - 确认扩展已加载并启用。
- 点击“批量播放”无反应？
  - 检查浏览器是否拦截了弹窗；在地址栏允许本域名弹窗。
  - 页面目录可能是动态加载，先展开或滚动到课程目录区域再点击。
- 播放页点击播放但进度不动？
  - 扩展会周期性强制 `video.play()`；如仍无效，尝试将标签页切到前台并交互一次（某些站点策略需要用户激活）。
  - 若播放器在 `iframe` 内部，需要额外适配选择器；请反馈页面 DOM 片段以便改进。
- 自动下一节不生效？
  - 不同课程模板按钮命名不同；请提供该页 DOM 结构（或截图中按钮的 HTML），我会增强选择器。

### 7. 权限说明
- `host_permissions`: `https://www.ycrczx.com/*`、`https://yctc.ycrczx.com/*`（注入脚本的站点范围）。
- `permissions`: `tabs`, `windows`（静音标签页、在新窗口中打开播放页）。

### 8. 目录结构（关键文件）
```
classAttender/
├─ manifest.json           # 扩展清单（MV3）
├─ background.js           # 后台：静音、创建新窗口
├─ content/
│  ├─ detail.js            # 课程详情页：按钮注入、批量打开
│  └─ learn.js             # 播放页：自动播放、静音、下一节
├─ scripts/
│  └─ package.sh           # 打包脚本：生成 dist/class-attender.zip
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

