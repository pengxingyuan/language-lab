# Language Lab

**A Personal Space for Language Learning.**

一个属于自己的多语言学习空间。

Language Lab 是一个基于原生 HTML、CSS 和 JavaScript 构建的个人语言学习网站。

项目以英语、法语、俄语和中文为核心，提供语言学习入口、每日国际新闻阅读，以及个人四语词汇管理功能。

它不仅是一个语言学习工具，也是一个用于记录、整理和积累个人语言学习成果的长期项目。

项目坚持简洁、轻量、实用的设计理念，不依赖复杂的前端框架，也不使用传统数据库，尽可能保持简单、独立和易于维护。

---

## ✦ 01 · Features

### 01. Language Learning

提供不同语言的独立学习入口：

- **English** · 英语
- **Français** · 法语
- **Русский** · 俄语

为不同语言提供独立的学习入口，未来可以逐步扩展阅读、语法、词汇和其他学习资源。

### 02. Today's Reading

每天展示来自不同语言媒体的国际新闻，尝试通过真实世界的内容接触不同语言。

目前包含：

- **EN** — BBC World
- **FR** — RFI
- **RU** — BBC Russian

主要功能：

- 通过 RSS 获取新闻内容
- 展示新闻标题、来源及日期
- 提供原文阅读链接
- 按语言展示不同新闻来源

新闻数据由独立的 Cloudflare Worker 获取和解析，不调用 AI API，不额外消耗模型 Token。

### 03. My Vocabulary

独立的四语个人词汇库，用于记录和整理不同语言之间的表达关系。

每条词汇记录可以包含：

| Field | Description |
|---|---|
| Concept | 概念名称 |
| English | 英语表达 |
| Français | 法语表达 |
| Русский | 俄语表达 |
| 中文 | 中文释义 |
| Examples | 多语言例句及中文对照 |
| My Notes | 个人备注 |

**Vocabulary Features**

- 动态添加多个语言表达
- 为不同语言添加多条例句
- 本地保存和读取词汇
- 删除已有词汇
- 实时搜索词汇
- 按语言筛选搜索
- JSON 数据导入与导出
- 黑色 × 荧光绿主题
- 浅色主题切换
- 桌面端与移动端适配

### 04. Cloud Synchronization

为了解决不同设备之间词汇数据无法共享的问题，项目增加了独立的云端同步服务。

**技术方案：GitHub + Cloudflare Workers**

主要组成：

- **GitHub** — 保存云端词汇数据
- **Cloudflare Workers** — 提供数据读取、写入与同步接口
- **GitHub OAuth / App Authorization** — 完成必要的身份授权
- **localStorage** — 保存浏览器本地词汇数据

云端词汇数据存储在 GitHub 仓库的 `data/vocabulary.json` 中。

主要功能：

- 从云端读取词汇数据
- 将本地词汇同步至云端
- 支持不同设备之间的数据同步
- 使用 GitHub 管理云端数据版本
- 通过数据版本校验降低并发修改造成的数据覆盖风险

项目不依赖传统数据库服务，通过 GitHub 和 Cloudflare 的基础设施实现轻量级个人数据同步。

---

## ✦ 02 · Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | 页面结构 |
| CSS3 | 页面样式与响应式布局 |
| JavaScript | 页面交互与数据管理 |
| localStorage | 本地词汇存储 |
| JSON | 词汇数据格式 |
| RSS | 国际新闻来源 |
| GitHub API | 云端词汇数据读写 |
| GitHub | 代码与数据版本管理 |
| Cloudflare Workers | RSS 获取、解析及云同步接口 |
| Cloudflare Pages | 网站托管与部署 |

本项目不依赖 React、Vue 等前端框架，主要使用原生 Web 技术构建。

---

## ✦ 03 · Project Structure

```text
language-lab/
│
├── assets/
│   └──                 # 图片及其他静态资源
│
├── index.html          # 网站首页
├── style.css           # 首页全局样式
├── script.js           # 首页交互与新闻展示
│
├── vocabulary.html     # 四语词汇库页面
├── vocabulary.css      # 词汇库独立样式
├── vocabulary.js       # 词汇录入、存储、搜索与展示
│
└── README.md           # 项目说明
```

注：RSS 服务和词汇云同步服务由独立的 Cloudflare Worker 提供，不属于上述前端目录。云端词汇数据保存在对应 GitHub 仓库中。

---

## ✦ 04 · Data Architecture

Language Lab 采用本地与云端相结合的数据管理方式。

**Local Storage**

浏览器通过 `localStorage` 保存本地词汇数据，保证日常录入和读取可以直接在本地完成。

**Cloud Storage**

通过 Cloudflare Worker 调用 GitHub API，将词汇数据保存到 GitHub 仓库中的 JSON 文件。

**Synchronization**

不同设备通过云端接口读取和更新词汇数据，实现个人词汇库的跨设备同步。

```text
                 Language Lab
                       │
              ┌────────┴────────┐
              │                 │
         Local Storage      Cloud Worker
          本地词汇缓存            │
                                │
                          GitHub API
                                │
                                ▼
                       vocabulary.json
                          云端词汇数据
```

这种设计尽量减少额外基础设施，同时保留数据的可迁移性和版本管理能力。

---

## ✦ 05 · Design Philosophy

**Simple. Clean. Personal.**

Language Lab 不追求复杂的功能堆叠，而是希望成为一个可以长期使用、持续积累的个人学习空间。

设计原则：

- **Minimalism** — 保持简洁，减少不必要的装饰。
- **Independence** — 不同功能模块尽可能独立。
- **Privacy** — 个人词汇采用本地与授权云端相结合的存储方式。
- **Lightweight** — 使用原生技术，减少外部依赖。
- **Expandable** — 为未来的新功能保留扩展空间。

词汇库采用独立的黑色与荧光绿色视觉主题，同时提供浅色主题，与网站其他页面保持相对独立。

---

## ✦ 06 · Deployment

网站使用 GitHub 进行版本管理，并通过 Cloudflare Pages 部署。

基本更新流程：

1. 在本地修改 HTML、CSS 或 JavaScript。
2. 使用 GitHub Desktop 提交更改。
3. 推送至 GitHub。
4. Cloudflare Pages 自动构建并部署。

相关服务：

- Website: https://language.pengxingyuan.top
- Hosting: Cloudflare Pages
- Source Code: GitHub

---

## ✦ 07 · Future Plans

Language Lab 将根据实际使用需求逐步迭代，不追求一次性加入大量功能。

### Learning Experience

- 完善英语、法语和俄语的学习入口
- 增加个人阅读记录
- 增加文章收藏与稍后阅读
- 探索语法笔记和学习资料整理功能

### Vocabulary Management

- 增加词汇分类与自定义标签
- 增加词汇排序和更灵活的筛选方式
- 优化词汇详情与例句展示
- 增加词汇复习与学习进度记录
- 进一步完善 JSON 导入、导出和备份体验

### Cloud & Data

- 完善云同步状态提示
- 优化多设备同时修改时的数据冲突处理
- 增加云端数据备份与恢复机制
- 进一步提升数据迁移的便利性

### UI & Experience

- 持续优化移动端使用体验
- 统一不同页面的交互细节
- 优化页面加载速度
- 保持简洁、轻量的视觉风格

以上内容属于未来规划，将根据实际使用体验逐步实现。

---

## ✦ About

**Language Lab**

*A small project, built for a long journey.*

一个慢慢搭建、持续积累的个人语言学习空间。

从记录一个单词开始，让语言学习成为长期而自然的习惯。

© 2026 Language Lab. All rights reserved.
