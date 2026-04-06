# GitHub CLI 快速操作指南

## ✅ 当前状态

- gh CLI 已安装：`~/.local/bin/gh` (v2.60.0)
- Token 已配置：`~/.config/gh/hosts.yml`
- Git Credential 已配置：`~/.git-credentials`

## 🚀 常用命令

### 仓库管理

```bash
# 查看当前仓库详情
gh repo view

# 查看仓库列表
gh repo list --limit 10

# 创建新仓库
gh repo create my-project --public --source=. --push

# 同步仓库
gh repo sync
```

### 推送代码（替代 git push）

```bash
# 方式 1：直接用 git（gh 已配置好 token）
git push

# 方式 2：用 gh
gh repo sync --force
```

### Pull Request

```bash
# 查看 PR 列表
gh pr list

# 创建 PR
gh pr create --title "功能名称" --body "描述内容"

# 查看 PR 详情
gh pr view <PR 号>

# 合并 PR
gh pr merge <PR 号> --merge

# 批准 PR
gh pr review <PR 号> --approve
```

### GitHub Actions

```bash
# 查看工作流
gh workflow list

# 触发工作流
gh workflow run "workflow 名称"

# 查看运行记录
gh run list

# 查看运行日志
gh run view <run-id> --log
```

### Release

```bash
# 创建 Release
gh release create v1.0.0 --title "v1.0.0" --generate-notes

# 查看 Release
gh release list

# 上传文件到 Release
gh release upload v1.0.0 ./file.zip
```

### Issues

```bash
# 查看 Issues
gh issue list

# 创建 Issue
gh issue create --title "问题" --body "描述"

# 查看 Issue
gh issue view <Issue 号>
```

## 📁 本项目操作示例

### 推送 docker-hub-pull-counter 更新

```bash
cd /home/node/.openclaw/workspace/docker-hub-pull-counter

# 查看状态
git status

# 提交更改
git add -A
git commit -m "更新说明"

# 推送
git push
# 或
gh repo sync
```

### 部署到 Vercel

```bash
# 安装 Vercel CLI
npm install -g vercel

# 登录
vercel login

# 部署
cd /home/node/.openclaw/workspace/docker-hub-pull-counter
vercel --prod
```

## 🔐 Token 管理

### 查看当前 Token 权限

```bash
gh auth status
```

### 刷新 Token 权限

```bash
gh auth refresh --scope read:org
```

### 重新登录

```bash
gh auth login
```

## 📝 最佳实践

1. **优先使用 gh 命令** - 比 curl 高效
2. **git push 自动用 token** - gh 配置好后 git 自动使用
3. **PR 工作流** - 用 `gh pr create` 代替网页
4. **Actions 触发** - 用 `gh workflow run` 代替网页
5. **Release 管理** - 用 `gh release` 系列命令

## ⚠️ 注意事项

- Token 权限：`repo`, `workflow`（缺少 `read:org`，个人使用不影响）
- Token 位置：`~/.config/gh/hosts.yml`
- Git Credential：`~/.git-credentials`
