# photo-note-xiaohongshu

移动端优先的照片笔记 MVP，使用 Tauri v2、React、TypeScript、Tailwind CSS 和 shadcn/ui。

## 开发环境

- Node.js 24+
- Rust stable
- Tauri 桌面端系统依赖

## 安装与启动

```bash
npm install
npm run tauri dev
```

仅启动前端预览：

```bash
npm run dev
```

移动端初始化在当前阶段暂不执行。后续需要时运行：

```bash
npm run tauri android init
npm run tauri ios init
```

## 项目结构

- `src/`：React 页面、shadcn/ui 组件与基础样式
- `src-tauri/`：Tauri Rust 宿主、配置与权限
- `src-tauri/capabilities/default.json`：主窗口插件权限

HTTP 插件已启用，但具体请求域名仍需在确定 LLM 服务后加入 capability scope。

## 数据库

SQLite 数据库文件为 `photo-note.db`，由 Tauri SQL 插件存放在应用配置目录。
建表迁移位于 `src-tauri/migrations/001_initial_schema.sql`，数据库首次加载时自动执行。

```ts
import { createAlbumGroup, listAlbumGroups } from "@/lib/db";

const group = await createAlbumGroup({ name: "旅行" });
const groups = await listAlbumGroups();
```

## 图片

图片文件保存在应用数据目录，数据库只保存应用相对路径：

- 原图：`photos/<group-id>/<photo-id>.<ext>`
- 缩略图：`thumbnails/<group-id>/<photo-id>.png`

```ts
import {
  captureCameraPhotoToAlbum,
  importSelectedImagesToAlbum,
} from "@/lib/image";

const selectedPhotos = await importSelectedImagesToAlbum(groupId);
const cameraPhoto = await captureCameraPhotoToAlbum(groupId);
```

## LLM

`src/lib/llm.ts` 支持 Mock 和 OpenAI 兼容接口，不包含硬编码服务地址。

```ts
import { generateNote } from "@/lib/llm";

const note = await generateNote("周末旅行", ["海边的日落", "桌边的咖啡"], {
  endpoint: "https://example.com/v1/chat/completions",
  apiKey: "your-api-key",
  model: "your-model",
  useMock: true,
});
```

真实请求需要在 `http:default` 对应的 capability scope 中允许目标 endpoint。
