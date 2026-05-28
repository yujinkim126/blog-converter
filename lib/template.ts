// 대표님 블로그 스타일 CSS — Ghost HTML 카드에 함께 들어감
export const BLOG_STYLE = `<style>
  .simple-blog-wrapper {
    max-width: 780px;
    margin: 0 auto;
    padding: 0 20px 40px 20px;
    background-color: #ffffff;
    color: #334155;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Pretendard", sans-serif;
    line-height: 1.85;
    letter-spacing: -0.01em;
  }
  .blog-header { margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid #e2e8f0; }
  .blog-body p { margin-top: 0; margin-bottom: 24px; text-align: justify; font-size: 1.05rem; }
  .section-title { font-size: 1.55rem; font-weight: 700; color: #1e3a8a; margin-top: 50px; margin-bottom: 20px; padding-bottom: 6px; border-bottom: 2px solid #1e3a8a; }
  .sub-title { font-size: 1.2rem; font-weight: 700; color: #0f172a; margin-top: 32px; margin-bottom: 12px; }
  .table-heading { font-size: 1.1rem; font-weight: 700; color: #1e3a8a; margin-top: 36px; margin-bottom: 12px; }
  .table-container { width: 100%; overflow-x: auto; margin-bottom: 32px; border: 1px solid #cbd5e1; border-radius: 4px; }
  .standard-table { width: 100%; border-collapse: collapse; font-size: 0.95rem; text-align: left; background-color: #ffffff; }
  .standard-table th { background-color: #f1f5f9; color: #0f172a; font-weight: 700; padding: 12px 16px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #cbd5e1; }
  .standard-table td { padding: 14px 16px; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; color: #334155; vertical-align: top; line-height: 1.6; }
  .standard-table th:last-child, .standard-table td:last-child { border-right: none; }
  .standard-table tbody tr:nth-child(even) { background-color: #f8fafc; }
  .standard-table tbody tr:last-child td { border-bottom: none; }
  .blog-body ul, .blog-body ol { padding-left: 20px; margin-top: 0; margin-bottom: 24px; font-size: 1.05rem; color: #334155; }
  .blog-body li { margin-bottom: 1.05rem; line-height: 1.85; }
  .blog-body li:last-child { margin-bottom: 0; }
  @media (max-width: 640px) {
    .simple-blog-wrapper { padding: 24px 16px; }
    .section-title { font-size: 1.35rem; margin-top: 40px; }
    .sub-title { font-size: 1.1rem; }
    .standard-table { font-size: 0.88rem; }
    .standard-table th, .standard-table td { padding: 10px 12px; }
  }
</style>`;

// Block → HTML 변환
export function blockToHtml(block: any): string {
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  switch (block.type) {
    case "h2":
      return `\n    <h2 class="section-title">${esc(block.text)}</h2>\n`;
    case "h3":
      return `\n    <h3 class="sub-title">${esc(block.text)}</h3>\n`;
    case "table-heading":
      return `\n    <h3 class="table-heading">${esc(block.text)}</h3>\n`;
    case "p":
      return `<p>${esc(block.text)}</p>\n`;
    case "p-html":
      return `<p>${block.html}</p>\n`;
    case "image": {
      const src = block.ghostUrl || block.src;
      return ` <img src="${src}" alt="${esc(block.alt)}" style="width: 100%; height: auto; margin: 24px 0;" />\n`;
    }
    case "table": {
      const tableHtml = block.html.replace(
        /<table(?![^>]*class)/g,
        '<table class="standard-table"'
      );
      return `\n<div class="table-container">${tableHtml}</div>\n`;
    }
    case "ul":
      return `<ul>\n${(block.items || []).map((i: string) => `      <li>${i}</li>`).join("\n")}\n    </ul>\n`;
    case "ol":
      return `<ol>\n${(block.items || []).map((i: string) => `      <li>${i}</li>`).join("\n")}\n    </ol>\n`;
    default:
      return "";
  }
}

// 전체 블록 배열 → 완성된 HTML
export function blocksToFullHtml(blocks: any[]): string {
  const body = blocks.map(blockToHtml).join("");

  return `<article class="simple-blog-wrapper">
<header class="blog-header">
<div class="blog-meta">
</div>
</header>

  <div class="is-narrow"></div>
  <div class="blog-body">
${body}
</div>
</article>

${BLOG_STYLE}`;
}
