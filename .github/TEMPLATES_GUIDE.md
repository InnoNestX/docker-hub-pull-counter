# GitHub 模板配置指南

## 📁 文件结构

```
.github/
├── ISSUE_TEMPLATE/
│   ├── config.yml           # Issue 配置
│   ├── bug_report.md        # Bug 报告模板
│   ├── feature_request.md   # 功能请求模板
│   └── api_issue.md         # API 问题模板
├── DISCUSSION_TEMPLATE/
│   ├── general.yml          # 一般讨论
│   ├── qna.yml              # 问答
│   └── show-and-tell.yml    # 项目展示
└── pull_request_template.md # PR 模板
```

## ✅ 已创建内容

### Issue 模板 (3 个)

| 模板 | 用途 | 标签 |
|------|------|------|
| 🐛 Bug Report | 报告 Bug | bug |
| 🚀 Feature Request | 新功能建议 | enhancement |
| ⚠️ API Issue | API 相关问题 | api, bug |

### Discussion 分类 (3 个)

| 分类 | 用途 |
|------|------|
| 📝 General Discussion | 一般讨论 |
| ❓ Q&A | 问答 |
| 🎉 Show and Tell | 项目展示 |

### PR 模板 (1 个)

| 模板 | 用途 |
|------|------|
| 📦 Pull Request | 代码提交 |

## 🔧 启用 Discussions

### 步骤 1: 在 GitHub 启用 Discussions

1. 访问仓库：https://github.com/InnoNestX/docker-hub-pull-counter
2. 点击 Settings (设置)
3. 在左侧菜单找到 General → Features
4. 勾选 ✓ Discussions
5. 点击 Save (如果有的话)

### 步骤 2: 配置 Discussion 分类

1. 点击仓库顶部的 Discussions 标签
2. 点击 New discussion
3. 点击右上角的 ⚙️ Settings (齿轮图标)
4. 点击 Add category
5. 创建以下分类：

| 名称 | 描述 | 图标 |
|------|------|------|
| General | General discussions about the project | 💬 |
| Q&A | Ask and answer questions | ❓ |
| Show and Tell | Share what you've built | 🎉 |

6. 为每个分类选择对应的模板（general.yml, qna.yml, show-and-tell.yml）

## 📋 使用方式

### 提交 Issue

访问：https://github.com/InnoNestX/docker-hub-pull-counter/issues/new/choose

用户会看到 3 个选项：

- 🐛 Bug Report
- 🚀 Feature Request
- ⚠️ API Issue

### 发起 Discussion

访问：https://github.com/InnoNestX/docker-hub-pull-counter/discussions

用户可以选择分类发起讨论。

### 提交 PR

访问：https://github.com/InnoNestX/docker-hub-pull-counter/compare

PR 描述框会自动加载模板。

## 🎨 模板特点

### Issue 模板

- ✅ 结构化表单
- ✅ 必填字段验证
- ✅ 自动添加标签
- ✅ 预设标题格式

### Discussion 模板

- ✅ 分类引导
- ✅ 结构化内容
- ✅ 便于搜索和整理

### PR 模板

- ✅ 变更类型选择
- ✅ 测试清单
- ✅ 关联 Issue
- ✅ 代码审查准备

## 🔗 相关链接

- [GitHub Issue 模板文档](https://docs.github.com/en/communytics/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)
- [GitHub Discussion 模板文档](https://docs.github.com/en/discussions/managing-discussions-for-your-community/managing-discussion-categories)
- [GitHub PR 模板文档](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)

---

**下一步:** 推送代码到 GitHub，然后在 GitHub 上启用 Discussions 功能！
