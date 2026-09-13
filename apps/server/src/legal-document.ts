const USER_AGENT = 'ResearchCanvas-Legal/1.0'

function stripUnsafeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
}

const BUNDLED_USER_AGREEMENT_HTML = stripUnsafeHtml(`
<article>
  <h1>Research Canvas 用户协议（摘要）</h1>
  <p>欢迎使用 Research Canvas。本软件用于投研信息整理与学习参考，不构成投资建议。</p>
  <h2>数据与隐私</h2>
  <p>对话、配置与关注列表默认保存在您自行部署的服务器或本机。您负责管理 API 密钥与访问权限。</p>
  <h2>免责声明</h2>
  <p>软件按「现状」提供，不对数据完整性、时效性或投资结果作任何保证。您应独立核实并自行承担决策风险。</p>
  <h2>许可</h2>
  <p>本软件基于 Apache License 2.0 发布。完整许可条款见仓库 LICENSE 文件。</p>
</article>
`.trim())

/** 自托管场景：返回内置协议 HTML，不依赖外部官网。 */
export async function fetchUserAgreementHtml(): Promise<{ html: string; sourceUrl: string }> {
  return {
    html: BUNDLED_USER_AGREEMENT_HTML,
    sourceUrl: '/api/legal/user-agreement',
  }
}

export { USER_AGENT }
