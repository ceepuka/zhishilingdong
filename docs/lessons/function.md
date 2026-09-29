# 函数使用错误

## f-string 兼容性错误
- 时间：2026-07-02
- 场景：配置管理脚本（component-config-manager）
- 错误：使用f-string `f"Hello {name}"`，在Python 2.7环境下报错
- 正确：使用 `%` 格式化 `"Hello %s" % name` 或 `.format()`
- 标签：f-string, Python版本, 兼容性

## json.dumps 换行符问题
- 时间：2026-07-01
- 场景：配置注入脚本（inject_config.py）
- 错误：`json.dumps(config, indent=2)` 产生换行符，注入到JavaScript中导致语法错误
- 正确：使用 `json.dumps(config, ensure_ascii=False).replace('\n', '\\n')` 或 `JSON.parse()` 方式
- 标签：json.dumps, JavaScript, 语法错误