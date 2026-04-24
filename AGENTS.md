# AGENTS.md

## Project Background

作为一个trader, 我希望能有一个记录和分析交易日志的系统, 它可以帮我发现交易中存在的问题.
我把这个项目命名为`trading-journal`, 它需要实现下面一些功能:

- 用户可以使用自然语言录入数据
- 一笔交易可以对应多笔入场/出场订单
- 在分析交易日志时, 不仅能给出胜率、盈亏比、回撤等客观的交易指标, 还能给出一些有深刻洞察的建议
- 使用cli作为`trading-journal`的沟通渠道

我打算使用nodejs, langchain等技术来完成这个项目.

## Data Model

### Account Object

```json
{
  "id": "A-002",
  "name": "tradeFi",
  "type": "tradeFi",
  "currency": "USD",
  "initial_balance": 1000,
  "pnl_mode": "auto",
  "fee_rate": 0.001,
  "default_risk_budget": 20
}
```

`Account` fields:

- `id` string, unique,
- `name` string, required
- `type` string: forex | commodities | crypto | stock | ...
- `currency` string, required
- `initial_balance` number, required
- `pnl_mode` enum: `auto | manual`, required
- `fee_rate` number, optional, default `0` (ratio; e.g., `0.0005`)
- `default_risk_budget` number, optional

## Coding Convention

 - 代码中一律使用英文, 包括注释.
 - 要求nodejs >= 22, 因为可以原生支持`.env`
 - 使用ESM, 而不是Commonjs等过时的模块系统. 导入本地文件时必须显式包含扩展名 `.js` 
 - 异步处理优先使用 `async/await`, 避免callback
 - 简短的逻辑、回调（如 `map/filter`）使用arrow function；顶层逻辑或类方法使用标准函数定义。
 - 变量/函数名使用 `camelCase`, 类名使用`PascalCase`, 常量使用`UPPER_SNAKE_CASE`
 - 代码格式:
   * 使用4空格 缩进
   * 强制使用分号
   * 字符串统一使用单引号 (`'`)，只有在模板字符串或 JSON 中才使用双引号。 
   * 强制使用 LF (Unix) 换行符。  
 - 导入顺序:  
   1. Node.js 内建模块
   2. 第三方包
   3. 本地模块（相对路径）
 - 文件命名规则:
   * 文件名使用全小写英文, 保持`kebab-case`格式
   * 命名应保持简短, 但必须语义明确, 如 `binance-v3-api.js` 而不是 `api-v3.js`
   * 入口文件：index.js 或 app.js/server.js
   * util函数放到helpers.js文件中, 要求util函数的复用性高(比如`sleep()`这种函数)并且无状态
   * 尽量保持项目扁平化结构, 除非有两个以上功能类似的模块, 再考虑将它们组织到一个目录里. 比如实现了binance-api.js, okx-api.js, gate-api.js,这时应当考虑把它们都放到exchange目录下.
  