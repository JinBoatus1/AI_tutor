# Git 开发流程指南

## 基本原则

- **不要直接在 main 分支上修改代码**
- 所有改动都通过 Pull Request (PR) 合并到 main
- main 分支始终是稳定的、可部署的版本

## 开发流程

### 1. 拉取最新代码

```bash
git checkout main
git pull origin main
```

### 2. 创建新分支

根据你要做的事情命名分支：

```bash
# 新功能
git checkout -b feature/功能名

# 修 bug
git checkout -b fix/bug描述

# 例如：
git checkout -b feature/login
git checkout -b fix/chat-crash
```

### 3. 开发 & 提交

在你的分支上正常写代码，写完后提交：

```bash
git add .
git commit -m "简要描述你做了什么"
```

可以多次 commit，不用等全部做完。

### 4. 推送到远程

```bash
git push origin 你的分支名

# 例如：
git push origin feature/login
```

### 5. 开 Pull Request

1. 打开 GitHub 仓库页面
2. 会看到提示 "Compare & pull request"，点击
3. 填写 PR 标题和描述（做了什么、为什么）
4. 点 "Create pull request"
5. 等待队友 review 通过后合并

### 6. 合并后清理

PR 合并到 main 后，删除你的分支：

```bash
git checkout main
git pull origin main
git branch -d feature/login
```

然后从第 1 步开始做下一个功能。

## 常用命令速查

| 操作 | 命令 |
|------|------|
| 查看当前分支 | `git branch` |
| 切换分支 | `git checkout 分支名` |
| 创建并切换分支 | `git checkout -b 新分支名` |
| 查看改动 | `git status` |
| 提交改动 | `git add . && git commit -m "描述"` |
| 推送分支 | `git push origin 分支名` |
| 拉取最新 main | `git checkout main && git pull` |
| 删除本地分支 | `git branch -d 分支名` |

## 注意事项

- **开始新功能前**，先回到 main 拉取最新代码再建分支
- **不要**直接 push 到 main（已设置分支保护，会被拒绝）
- 如果你的分支开发时间较长，定期从 main 合并最新代码避免冲突：
  ```bash
  git checkout 你的分支
  git merge main
  ```
- 一个 PR 只做一件事，不要把多个不相关的功能塞在一个 PR 里
