# Language Lab

**A Personal Space for Language Learning.**

一个属于自己的多语言学习空间。

Language Lab 是一个基于原生 HTML、CSS 和 JavaScript 构建的个人语言学习网站。

它以英语、法语、俄语和中文为核心，提供语言学习入口、每日国际新闻阅读，以及个人四语词汇收藏功能。

项目坚持简洁、轻量、实用的设计理念，不依赖复杂的前端框架，也不使用数据库，尽可能保持简单和易于维护。

---

## ✦ Features

### 01. Language Learning

- English · 英语
- Français · 法语
- Русский · 俄语

为不同语言提供独立的学习入口，后续可以逐步扩展阅读、语法和学习资源。

### 02. Today's Reading

每天展示来自不同语言媒体的国际新闻：

- **EN** — BBC World
- **FR** — RFI
- **RU** — BBC Russian

通过 RSS 获取新闻标题、来源、日期和原文链接。

新闻由独立 Cloudflare Worker 负责获取和解析，不调用 AI API，不额外消耗模型 Token。

### 03. My Vocabulary

独立的四语个人词汇库。

每条记录可以包含：

- Concept：概念名称
- English：英语表达
- Français：法语表达
- Русский：俄语表达
- 中文：中文释义
- Examples：多语言例句及中文对照
- My Notes：个人备注

**Vocabulary Features**

- 动态添加多个语言表达
- 为不同语言添加多条例句
- 本地保存和读取词汇
- 删除已有词汇
- 实时搜索词汇
- 按语言筛选搜索
- 黑色 × 荧光绿主题
- 浅色主题切换
- 桌面端与移动端适配

词汇数据目前使用浏览器 `localStorage` 保存，不需要注册账号或连接数据库。

---

## ✦ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | 页面结构 |
| CSS3 | 页面样式与响应式布局 |
| JavaScript | 页面交互与数据管理 |
| localStorage | 本地词汇存储 |
| RSS | 国际新闻来源 |
| Cloudflare Workers | RSS 数据获取与解析 |
| Cloudflare Pages | 网站部署 |
| GitHub | 代码托管与版本管理 |

本项目不依赖 React、Vue 等前端框架。

---

## ✦ Project Structure

```text
language-lab/
│
├── assets/
│   └──             # 图片及其他静态资源
│
├── index.html      # 网站首页
├── style.css       # 首页全局样式
├── script.js       # 首页交互与新闻展示
│
├── vocabulary.html # 四语词汇库页面
├── vocabulary.css  # 词汇库独立样式
├── vocabulary.js   # 词汇录入、存储、搜索与展示
│
└── README.md       # 项目说明
```

---

## ✦ Design Philosophy

**Simple. Clean. Personal.**

Language Lab 不追求复杂的功能堆叠，而是希望成为一个长期使用、持续积累的个人学习空间。

设计原则：

- Minimalism：保持简洁，减少不必要的装饰。
- Independence：不同功能模块尽可能独立。
- Privacy：个人词汇优先保存在本地浏览器。
- Lightweight：使用原生技术，减少外部依赖。
- Expandable：为未来的新功能保留扩展空间。

词汇库采用独立的黑色与荧光绿色视觉主题，与网站其他页面保持相对独立。

---

## ✦ Deployment

网站使用 GitHub 进行版本管理，并通过 Cloudflare Pages 部署。

基本更新流程：

1. 在本地修改 HTML、CSS 或 JavaScript。
2. 使用 GitHub Desktop 提交更改。
3. 推送至 GitHub。
4. Cloudflare Pages 自动构建并部署。

---

## ✦ Future Plans

未来可能逐步加入：

- 更多语言与学习入口
- 阅读记录与个人学习笔记
- 词汇分类与标签
- 更完善的词汇筛选功能
- 学习内容的导入与导出
- 更多个人化学习工具

这些功能将根据实际使用需求逐步实现，而不是一次性堆叠。

---

## About

**Language Lab**

A small project, built for a long journey.

一个慢慢搭建、持续积累的个人语言学习空间。

© 2026 Language Lab. All rights reserved.