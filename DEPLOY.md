# 🚀 部署指南

## 项目状态

- ✅ 代码已推送到 GitHub
- ✅ gh CLI 已配置
- 🔲 等待部署到 Vercel

---

## 方案 1：Vercel（最简单，推荐）

### 步骤：

1. **访问 Vercel**
   - 打开 https://vercel.com/new
   - 点击 "Import Git Repository"
   - 选择 `docker-hub-pull-counter`

2. **部署**
   - 点击 "Deploy"
   - 等待自动构建

3. **获取域名**
   - 部署完成后获得类似 `https://docker-hub-pull-counter.vercel.app` 的域名

### 可选：配置 Docker Hub 认证（提高 API 限额）

在 Vercel 项目设置中添加环境变量：
- `DOCKER_USERNAME` - 你的 Docker Hub 用户名
- `DOCKER_PASSWORD` - 你的 Docker Hub 密码

---

## 方案 2：Railway

### 步骤：

1. 访问 https://railway.app

2. 创建新项目 → "Deploy from GitHub repo"

3. 选择 `XuXuClassMate/docker-hub-pull-counter`

4. Railway 会自动检测 Node.js 并部署

5. 获取生成的域名（类似 `https://xxx-production.up.railway.app`）

### 配置环境变量：

在 Railway 项目设置中添加：
- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

---

## 方案 3：Render

### 步骤：

1. 访问 https://render.com

2. 创建 "Web Service"

3. 连接 GitHub 仓库

4. 配置：
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node

5. 创建服务

6. 获取域名（类似 `https://xxx.onrender.com`）

---

## 方案 4：Cloudflare Workers（免费额度高）

### 步骤：

1. 安装 Wrangler CLI
   ```bash
   npm install -g wrangler
   ```

2. 登录
   ```bash
   wrangler login
   ```

3. 创建 `wrangler.toml`:
   ```toml
   name = "docker-hub-pull-counter"
   main = "server.js"
   compatibility_date = "2024-01-01"
   ```

4. 部署
   ```bash
   wrangler deploy
   ```

---

## 方案 5：Docker 部署（任意 VPS）

### 运行

```bash
docker build -t docker-hub-pull-counter .
docker run -p 3000:3000 docker-hub-pull-counter
```

---

## 📊 API 使用示例

### 查询用户统计

```bash
curl "https://your-domain.com/api/stats?username=xuxuclassmate"
```

### 响应示例

```json
{
  "success": true,
  "username": "xuxuclassmate",
  "repositoryCount": 5,
  "totalPulls": 1234567,
  "totalPullsFormatted": "1,234,567",
  "repositories": [
    {
      "name": "my-image",
      "pullCount": 1000000,
      "starCount": 500,
      "isPrivate": false,
      "description": "My awesome image"
    }
  ],
  "timestamp": "2026-04-06T09:52:00.000Z"
}
```

---

## ⚠️ 注意事项

### API 速率限制

- **未认证**: 约 100-200 请求/小时
- **已认证**: 更高限额（具体取决于 Docker Hub 账户类型）

### 建议

1. 添加缓存层（如 Redis）减少 API 调用
2. 对于热门用户名，缓存结果 5-10 分钟
3. 监控错误率，处理 429 错误

---

## 🎯 下一步优化

- [ ] 添加缓存（Redis/内存缓存）
- [ ] 添加访问统计
- [ ] 支持组织（Organization）查询
- [ ] 添加 Pull 趋势图表
- [ ] 支持导出 CSV
