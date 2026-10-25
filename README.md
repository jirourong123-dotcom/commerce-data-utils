# Commerce Data Utils

轻量、零第三方依赖的 CommonJS 数据处理工具。当前是待发布审核的独立副本，**不是完整业务后台，也不能替代原私有项目的测试和部署**。

## 运行

需要 Node.js 22 或更新版本；CI 使用 Node.js 24。

```sh
npm test
npm run demo
npm run check:public
```

无需 `npm install`，无需数据库、账号、凭据或业务数据。所有测试和示例数据都是新编造的。

```js
const { availability } = require('./');
const count = availability.calculateCatalogAvailableQuantityFromDetails({
  materials: [{ code: 'DEMO01', quantity: 2, stock: 10 }],
}); // 5
```

## 模块

| 导出 | 功能 |
| --- | --- |
| availability | 根据物料用量和库存计算可用数量；未知库存返回 null |
| materials | 中文材料文本解析及结构化字段归一化 |
| references | 来源记录归一化、文本用量解析、精确编码匹配与冲突标记 |
| currency | 仅在来源身份和明确 CNY 证据一致时确认币种 |
| pagination | 分页参数、数据修订摘要与快照标识 |
| businessDate | Asia/Shanghai 日期边界 |
| fence | 比较可见性版本与数据代次 |
| encoding | 有限的乱码识别、修复与显示回退 |

保留提取模块原有函数名和语义。函数接收调用方提供的结构化输入；这些工具不提供数据库、权限系统、抓取、业务写入或平台 API 集成。修订摘要不是认证令牌；图片 URL 的格式检查不等于允许服务端抓取。乱码识别属于启发式，无法保证修复所有损坏文本。

## 免费 CI 的边界

工作流只测试本公开候选的代码，使用标准 Ubuntu runner，token 权限只读，不拉取私有仓库，不上传构建产物，不启用缓存、部署或定时任务。

GitHub 对公开仓库的标准 GitHub-hosted Actions 运行提供免费分钟使用，但并发、时长、存储等仍有限制；这不代表 Codespaces、Copilot 或所有服务无限免费。新副本不会自动解除原私有仓库的额度限制。参见 [Actions 计费](https://docs.github.com/en/billing/concepts/product-billing/github-actions) 和 [Actions 限制](https://docs.github.com/en/actions/reference/limits)。

## 发布状态

尚未公开上传。当前 `license: UNLICENSED`，未授予开源许可；待所有者确认许可证及代码再分发权利后再发布。`private: true` 防止误发到 npm，不控制 GitHub 仓库可见性。

已排除原 Git 历史、内部文档、运维脚本、业务截图、导出表格和生产配置。见 PROVENANCE.md。自动扫描只能发现部分风险，发布前仍须人工检查最终文件与提交。
