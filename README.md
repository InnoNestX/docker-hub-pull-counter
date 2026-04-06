# Docker Hub Pull Counter

一个免费的 Web 服务，用于查询 Docker Hub 用户名下所有公共仓库的总 Pull 次数。

![XuXuClassMate's GitHub stats](https://github-readme-stats.vercel.app/api?username=XuXuClassMate&show_icons=true&theme=vue&show=prs_merged,prs_merged_percentage)

## 🌐 在线使用

部署后访问：`https://your-domain.com?username=xuxuclassmate`

## 🚀 快速部署

### 方案 1：Vercel（推荐）

```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
cd docker-hub-pull-counter
vercel --prod
```

### 方案 2：Railway

1.  Fork 此仓库到 GitHub
2.  在 Railway 创建新项目，连接 GitHub 仓库
3.  自动部署

### 方案 3：Render

1.  创建新的 Web Service
2.  连接 GitHub 仓库
3.  Build Command: `npm install`
4.  Start Command: `npm start`

## 📖 API 使用

### 查询用户总 Pull 数

```bash
GET /api/stats?username={username}
```

**响应示例：**
```json
{
  "username": "xuxuclassmate",
  "repositoryCount": 5,
  "totalPulls": 1234567,
  "repositories": [
    {
      "name": "image1",
      "pullCount": 1000000,
      "starCount": 500
    }
  ]
}
```

### 前端页面

访问 `/` 并输入用户名查询。

## 🛠 本地开发

```bash
npm install
npm run dev
```

访问 http://localhost:3000

## ⚠️ 限制

- Docker Hub 未认证 API 限制：约 100-200 请求/小时
- 如需更高配额，可配置 `DOCKER_USERNAME` 和 `DOCKER_PASSWORD` 环境变量获取 Token

## 📄 License

MIT
