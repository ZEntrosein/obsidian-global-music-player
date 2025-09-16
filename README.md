# 🎵 Global Music Player for Obsidian

> 一个智能的全局音乐播放器，能够根据文件和内容自动切换音乐，让你的 Obsidian 体验更加沉浸。

[![GitHub release](https://img.shields.io/github/v/release/ZEntrosein/obsidian-global-music-player)](https://github.com/ZEntrosein/obsidian-global-music-player/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 主要特性

### 🎯 智能音乐管理
- **📄 Frontmatter 支持**: 在文件元数据中直接指定音乐
- **⚙️ 规则系统**: 基于文件路径、标签、扩展名等创建自动播放规则
- **🔄 优先级控制**: 灵活的优先级系统，支持多层级音乐选择
- **🎚️ 无缝切换**: 文件切换时自动播放对应音乐

### 🎼 强大的音频引擎
- **🎵 多格式支持**: MP3, WAV, OGG, FLAC, M4A, AAC
- **🌐 多种音源**: 本地文件、在线 URL、Data URL 全面支持
- **🔒 安全播放**: 智能路径解析，支持 Obsidian 库内文件安全播放
- **🎛️ 音量控制**: 独立音量控制和全局音量管理

### 🎨 用户界面
- **📊 状态栏集成**: 实时显示播放状态和音乐来源
- **⚙️ 完整设置面板**: 直观的配置界面
- **🔍 来源指示**: 清晰的音乐来源标识
  - 📄 = Frontmatter
  - ⚙️ = 规则系统
  - 🎵 = 默认

## 🚀 快速开始

### 📦 安装

1. **手动安装**:
   ```bash
   # 下载最新版本
   cd your-vault/.obsidian/plugins/
   git clone https://github.com/ZEntrosein/obsidian-global-music-player.git
   cd obsidian-global-music-player
   npm install && npm run build
   ```

2. **启用插件**: 在 Obsidian 设置 → 第三方插件中启用 "Global Music Player"

### 🎵 基本使用

#### 方法 1: Frontmatter 音乐（推荐）

在任何 Markdown 文件开头添加音乐属性：

```yaml
---
music: music/focus/deep-work.mp3
title: "工作计划"
---

# 今日工作计划
当打开这个文件时，会自动播放专注音乐...
```

**支持的属性名称**:
- `music` (主要属性)
- `background-music`
- `bgm`
- `audio`
- `soundtrack`

#### 方法 2: 智能规则系统

在插件设置中创建自动播放规则：

| 规则类型 | 示例匹配 | 音乐路径 | 说明 |
|----------|----------|----------|------|
| 文件路径 | `/work/` | `music/focus.mp3` | 工作文件夹下的文件 |
| 文件扩展名 | `md` | `music/ambient.wav` | 所有 Markdown 文件 |
| 文件标签 | `#study` | `music/study.ogg` | 包含学习标签的文件 |
| 段落标题 | `## 会议` | `music/meeting.mp3` | 特定段落内容 |

## 📝 实际使用场景

### 🎯 专注工作模式
```yaml
---
music: music/focus/binaural-beats.wav
tags: [work, focus, deep-work]
---

# 🚀 项目开发计划
- 后端 API 设计
- 前端界面开发
- 测试用例编写
```

### 📚 学习笔记模式
```yaml
---
bgm: music/study/nature-sounds.mp3
tags: [study, notes]
---

# 📖 学习笔记：JavaScript 进阶
## 异步编程
### Promise 和 async/await
```

### 🌙 放松阅读模式
```yaml
---
audio: music/relaxing/cafe-ambience.wav
---

# 📝 每日反思
今天的收获和感悟...
```

### 🌐 在线音乐
```yaml
---
music: https://example.com/background-music.mp3
---
```

## ⚙️ 详细配置

### 🎵 Frontmatter 音乐设置
- **启用状态**: 开启/关闭 frontmatter 音乐功能
- **主属性名**: 自定义主要属性名称（默认：`music`）
- **优先级模式**: 
  - `Frontmatter 优先`：文件属性覆盖规则（推荐）
  - `规则优先`：规则系统可覆盖文件属性

### 🔊 音频引擎设置
- **默认音量**: 0.0 - 1.0 范围内调节
- **自动播放**: 文件切换时自动开始播放
- **渐变时间**: 音轨切换的淡入淡出时间（毫秒）
- **音乐文件夹**: 设置默认音乐存储目录

### 📐 规则系统配置
每个规则包含：
- **规则名称**: 便于管理的自定义名称
- **触发类型**: 
  - `file-path`: 文件路径匹配
  - `file-tag`: 文件标签匹配
  - `section-header`: 段落标题匹配
  - `file-extension`: 文件扩展名匹配
- **匹配模式**: 支持正则表达式的匹配规则
- **音乐路径**: 要播放的音频文件路径
- **优先级**: 1-100，数字越大优先级越高
- **启用状态**: 开启/关闭特定规则

## 🎮 操作指南

### 🖱️ 状态栏操作
- **点击播放图标**: 播放/暂停当前音乐
- **音乐名称显示**: 显示当前播放的音轨名称
- **来源指示器**: 显示音乐来源类型

### ⌨️ 快捷操作
| 功能 | 操作方式 | 说明 |
|------|----------|------|
| 播放/暂停 | 点击状态栏图标 | 切换播放状态 |
| 停止播放 | 插件设置 | 可配置快捷键 |
| 音量调节 | 插件设置 | 可配置快捷键 |
| 下一首 | 未来版本 | 播放列表功能 |

## 🔧 开发与贡献

### 本地开发环境
```bash
# 克隆项目
git clone https://github.com/ZEntrosein/obsidian-global-music-player.git
cd obsidian-global-music-player

# 安装依赖
npm install

# 开发模式（自动重编译）
npm run dev

# 生产构建
npm run build
```

### 项目结构
```
obsidian-global-music-player/
├── main.ts              # 插件主文件
├── styles.css           # 样式文件
├── manifest.json        # 插件清单
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
├── esbuild.config.mjs   # 构建配置
└── README.md            # 项目文档
```

### 贡献指南
1. **Fork 项目** 到你的 GitHub 账户
2. **创建功能分支**: `git checkout -b feature/amazing-feature`
3. **提交更改**: `git commit -m 'Add amazing feature'`
4. **推送分支**: `git push origin feature/amazing-feature`
5. **创建 Pull Request**

## 📋 版本规划

### ✅ v1.0.0（当前版本）
- [x] Frontmatter 音乐支持
- [x] 基础规则系统
- [x] 多格式音频支持
- [x] 状态栏集成
- [x] 完整设置面板

### 🚧 v1.1.0（计划中）
- [ ] 播放列表支持
- [ ] 音频淡入淡出效果
- [ ] 快捷键自定义
- [ ] 音乐可视化界面

### 🔮 v1.2.0（未来计划）
- [ ] 段落级别音乐切换
- [ ] 工作区布局相关规则
- [ ] 音乐推荐系统
- [ ] 社区音乐库

## 🐛 故障排除

### 常见问题

**Q: 本地音频文件无法播放？**
A: 确保音频文件路径正确，相对于 vault 根目录。支持的格式：MP3, WAV, OGG, FLAC, M4A, AAC。

**Q: 在线音频无法播放？**
A: 检查 URL 是否有效，以及是否存在 CORS 限制。

**Q: 音乐不会自动切换？**
A: 检查插件设置中的"自动播放"选项是否开启，以及规则是否正确配置。

**Q: Frontmatter 音乐不生效？**
A: 确保 frontmatter 格式正确，属性名称匹配，并且 frontmatter 功能已启用。

### 获取帮助
- 🐛 **Bug Report**: [GitHub Issues](https://github.com/ZEntrosein/obsidian-global-music-player/issues)
- 💬 **讨论**: [GitHub Discussions](https://github.com/ZEntrosein/obsidian-global-music-player/discussions)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

## 🌟 支持项目

如果这个插件对你有帮助，请考虑：
- ⭐ 给项目加星
- 🐛 报告问题
- 💡 提出建议
- 🤝 贡献代码
- ☕ [支持开发](https://buymeacoffee.com/zentrosein)

---

<div align="center">

**让音乐为你的思维加速** 🎵

Made with ❤️ by [ZEntrosein](https://github.com/ZEntrosein)

</div>
