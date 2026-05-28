"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── TYPES ───────────────────────────────────────────────
type BlockType =
  | "h2"
  | "h3"
  | "table-heading"
  | "p"
  | "p-html"
  | "image"
  | "table"
  | "ul"
  | "ol";

interface Block {
  id: string;
  type: BlockType;
  text?: string;
  html?: string;
  src?: string;
  alt?: string;
  ghostUrl?: string;
  uploaded?: boolean;
  items?: string[];
}

type Step = "input" | "edit" | "preview";
type PublishStatus = null | "uploading" | "draft_ok" | "published_ok" | "error";

// ─── STYLE TEMPLATE (미리보기용) ─────────────────────────
const PREVIEW_STYLE = `
  .simple-blog-wrapper { max-width: 780px; margin: 0 auto; padding: 0 20px 40px 20px; background-color: #ffffff; color: #334155; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Pretendard", sans-serif; line-height: 1.85; letter-spacing: -0.01em; }
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
`;

// ─── HELPERS ─────────────────────────────────────────────
function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function toPostSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/[^/]+\/?/, "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── MAIN COMPONENT ─────────────────────────────────────
export default function BlogConverter() {
  const [step, setStep] = useState<Step>("input");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [postSlug, setPostSlug] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  // const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>(null);
  const [showHtmlModal, setShowHtmlModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const pasteRef = useRef<HTMLDivElement>(null);

  // ESC 키로 미리보기 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && step === "preview") {
        setStep("edit");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [step]);

  // ─── PASTE HANDLER ────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData("text/html");
    const text = e.clipboardData.getData("text/plain");
    const content = html || text;
    if (!content.trim()) return;

    const parsed = parseContent(content, !!html);
    if (parsed.length > 0) {
      setBlocks(parsed);
      // 제목은 자동 파싱하지 않음 — 사용자가 직접 입력
      setStep("edit");
    }
  }, []);

  // ─── CONTENT PARSER (v2 — 구글독스 최적화) ─────────────

  // 구글독스 inline 스타일 쓰레기 제거
  function stripGdocStyles(html: string): string {
    // <span style="font-size:11pt;font-family:Arial,...">텍스트</span> → 텍스트
    return (
      html
        .replace(
          /<span[^>]*style="[^"]*font-size:\s*\d+pt[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
          "$1",
        )
        .replace(
          /<span[^>]*style="[^"]*font-family:[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
          "$1",
        )
        // 빈 span 정리
        .replace(/<span[^>]*>\s*<\/span>/gi, "")
        // dir="ltr" role="presentation" 등 구글독스 속성 정리
        .replace(/\s*(dir|role|style)="[^"]*"/gi, "")
        // 연속 공백/줄바꿈 정리
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  // HTML에서 텍스트만 추출 (태그 제거)
  function textOnly(html: string): string {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return (tmp.textContent || "").trim();
  }

  // 링크를 보존하면서 나머지 스타일 제거
  function cleanHtmlPreserveLinks(el: HTMLElement): string {
    const links = el.querySelectorAll("a");
    if (links.length === 0) return "";

    // 먼저 전체 텍스트에서 링크 위치를 파악
    let cleaned = stripGdocStyles(el.innerHTML);
    // 링크 스타일 통일
    const tmpDiv = document.createElement("div");
    tmpDiv.innerHTML = cleaned;
    tmpDiv.querySelectorAll("a").forEach((a) => {
      const href = a.getAttribute("href") || "";
      const text = a.textContent || "";
      const styled = document.createElement("a");
      styled.href = href;
      styled.target = "_blank";
      styled.rel = "noopener noreferrer";
      styled.style.color = "#2980b9";
      styled.textContent = text;
      a.replaceWith(styled);
    });
    // 남은 span 등 정리
    tmpDiv.querySelectorAll("span").forEach((span) => {
      span.replaceWith(document.createTextNode(span.textContent || ""));
    });
    return tmpDiv.innerHTML.trim();
  }

  // "alt-text:", "이미지 파일명:", "타겟 쿼리" 등 메타 패턴 감지
  function detectMetaPattern(
    text: string,
  ): "alt-text" | "filename" | "internal-memo" | null {
    const t = text.trim();
    if (/^alt[\-\s]?text\s*[:：]/i.test(t)) return "alt-text";
    if (/^이미지\s*파일명\s*[:：]/i.test(t)) return "filename";
    if (/^(\d+개\s*)?타겟\s*쿼리/i.test(t)) return "internal-memo";
    if (/^(정의|주\s*의도|하위)\s*쿼리\s*[-–—]/i.test(t))
      return "internal-memo";
    return null;
  }

  // 구글독스 테이블 정규화 — 스타일/span 제거, thead/tbody 구조화
  function normalizeGdocTable(table: HTMLTableElement): string {
    const rows = Array.from(table.querySelectorAll("tr"));
    if (rows.length === 0) return "<table></table>";

    const normalizedRows = rows
      .map((row, rowIndex) => {
        const cells = Array.from(row.children).filter((cell) => {
          const t = cell.tagName.toLowerCase();
          return t === "td" || t === "th";
        });
        if (cells.length === 0) return "";

        const cellHtml = cells
          .map((cell) => {
            const tagName = rowIndex === 0 ? "th" : "td";
            const colspan = cell.getAttribute("colspan");
            const rowspan = cell.getAttribute("rowspan");
            const attrs = [
              colspan ? `colspan="${escAttr(colspan)}"` : "",
              rowspan ? `rowspan="${escAttr(rowspan)}"` : "",
            ]
              .filter(Boolean)
              .join(" ");
            const content = cleanTableCellContent(cell as HTMLElement);
            return attrs
              ? `<${tagName} ${attrs}>${content}</${tagName}>`
              : `<${tagName}>${content}</${tagName}>`;
          })
          .join("");

        return `<tr>${cellHtml}</tr>`;
      })
      .filter(Boolean);

    const head = normalizedRows[0] ? `<thead>${normalizedRows[0]}</thead>` : "";
    const bodyRows = normalizedRows.slice(1).join("");
    const body = bodyRows ? `<tbody>${bodyRows}</tbody>` : "";
    return `<table>${head}${body}</table>`;
  }

  function cleanTableCellContent(cell: HTMLElement): string {
    const cloned = cell.cloneNode(true) as HTMLElement;
    cloned
      .querySelectorAll("style, script, meta, link")
      .forEach((n) => n.remove());
    cloned.querySelectorAll("[style], [class], [dir], [role]").forEach((n) => {
      n.removeAttribute("style");
      n.removeAttribute("class");
      n.removeAttribute("dir");
      n.removeAttribute("role");
    });
    cloned
      .querySelectorAll("span")
      .forEach((s) =>
        s.replaceWith(document.createTextNode(s.textContent || "")),
      );
    cloned
      .querySelectorAll("p")
      .forEach((p) =>
        p.replaceWith(document.createTextNode(p.textContent || "")),
      );
    cloned
      .querySelectorAll("br")
      .forEach((br) => br.replaceWith(document.createTextNode(" ")));
    return esc((cloned.textContent || "").replace(/\s+/g, " ").trim());
  }

  function escAttr(s: string): string {
    return esc(s).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // 구조화된 컨테이너 감지 — 자식을 재귀 탐색해야 하는 div/article/section 등
  function isStructuredContainer(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (!["article", "section", "main", "div", "figure", "body"].includes(tag))
      return false;
    const children = Array.from(el.children);
    if (children.length === 0) return false;
    return children.some((child) => {
      const childTag = child.tagName.toLowerCase();
      if (
        [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "ul",
          "ol",
          "table",
          "img",
          "figure",
          "blockquote",
        ].includes(childTag)
      )
        return true;
      return Boolean(
        child.querySelector(
          "h1, h2, h3, h4, h5, h6, p, ul, ol, table, img, figure, blockquote",
        ),
      );
    });
  }

  // standard-table 클래스 추가
  function addStandardTableClass(html: string): string {
    if (!html.trim()) return '<table class="standard-table"></table>';
    return html.replace(
      /<table(?![^>]*class=)/i,
      '<table class="standard-table"',
    );
  }

  // 제목 후보 감지: 짧은 텍스트 + 물음표/마침표 없음 + 다음 블록이 긴 본문
  function isLikelyHeading(text: string): boolean {
    const t = text.trim();
    if (t.length > 80 || t.length < 2) return false;
    // 마침표로 끝나면 본문일 가능성 높음 (한국어 서술형 종결)
    if (
      t.endsWith("습니다.") ||
      t.endsWith("합니다.") ||
      t.endsWith("됩니다.") ||
      t.endsWith("입니다.")
    )
      return false;
    // 일반 마침표로 끝나도 본문
    if (t.endsWith(".") && !t.endsWith("?")) return false;
    // ?로 끝나는 질문형 제목 ("~무엇인가?", "~방식") — 제목으로 인정
    if (t.endsWith("?") && t.length <= 60) return true;
    // "~란 무엇인가" 패턴 (물음표 없이도)
    if (/란\s+무엇인가$/.test(t)) return true;
    // 40자 이하 명사형 종결 (서술형이 아닌 것)
    if (t.length <= 50) return true;
    return false;
  }

  function parseContent(content: string, isHtml: boolean): Block[] {
    const raw: Block[] = [];

    if (!isHtml) {
      const lines = content.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("### ")) {
          raw.push({
            type: "table-heading",
            text: trimmed.slice(4),
            id: genId(),
          });
        } else if (trimmed.startsWith("## ")) {
          raw.push({ type: "h3", text: trimmed.slice(3), id: genId() });
        } else if (trimmed.startsWith("# ")) {
          raw.push({ type: "h2", text: trimmed.slice(2), id: genId() });
        } else {
          raw.push({ type: "p", text: trimmed, id: genId() });
        }
      }
      return postProcess(raw);
    }

    // ── HTML 파싱 ──
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, "text/html");

    function walk(node: Node) {
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType === 3) {
          const t = (child.textContent || "").trim();
          if (t) raw.push({ type: "p", text: t, id: genId() });
          continue;
        }
        if (child.nodeType !== 1) continue;

        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();

        // Images (standalone or inside spans)
        if (tag === "img") {
          const src = el.getAttribute("src") || "";
          if (src) {
            raw.push({
              type: "image",
              src,
              alt: el.getAttribute("alt") || "",
              id: genId(),
              uploaded: false,
              ghostUrl: "",
            });
          }
          continue;
        }

        // Tables — normalizeGdocTable로 정규화
        if (tag === "table") {
          raw.push({
            type: "table",
            html: normalizeGdocTable(el as HTMLTableElement),
            id: genId(),
          });
          continue;
        }

        // 구조화된 컨테이너 (article, div 등)는 자식을 재귀 탐색
        if (isStructuredContainer(el)) {
          walk(el);
          continue;
        }

        // Headings
        if (tag === "h1" || tag === "h2") {
          raw.push({ type: "h2", text: textOnly(el.innerHTML), id: genId() });
          continue;
        }
        if (tag === "h3") {
          raw.push({ type: "h3", text: textOnly(el.innerHTML), id: genId() });
          continue;
        }
        if (tag === "h4" || tag === "h5" || tag === "h6") {
          raw.push({
            type: "table-heading",
            text: textOnly(el.innerHTML),
            id: genId(),
          });
          continue;
        }

        // Lists — 아이템 내 span 쓰레기 정리
        if (tag === "ul" || tag === "ol") {
          const items: string[] = [];
          el.querySelectorAll(":scope > li").forEach((li) => {
            // li 안의 span 스타일 정리, 링크는 보존
            const hasLinks = li.querySelectorAll("a").length > 0;
            if (hasLinks) {
              items.push(cleanHtmlPreserveLinks(li as HTMLElement));
            } else {
              items.push((li.textContent || "").trim());
            }
          });
          if (items.length > 0) {
            raw.push({ type: tag as "ul" | "ol", items, id: genId() });
          }
          continue;
        }

        // Paragraphs / divs / spans
        if (tag === "p" || tag === "div" || tag === "span") {
          // 이미지 포함 체크
          const innerImgs = el.querySelectorAll("img");
          if (innerImgs.length > 0) {
            innerImgs.forEach((img) => {
              const src = img.getAttribute("src") || "";
              if (src) {
                raw.push({
                  type: "image",
                  src,
                  alt: img.getAttribute("alt") || "",
                  id: genId(),
                  uploaded: false,
                  ghostUrl: "",
                });
              }
            });
            // 이미지 외 텍스트가 있으면 추가
            const remainingText = textOnly(el.innerHTML)
              .replace(/\s+/g, " ")
              .trim();
            // 이미지 src URL 텍스트는 제거
            if (remainingText && remainingText.length > 5) {
              raw.push({ type: "p", text: remainingText, id: genId() });
            }
          } else {
            // 링크 포함 체크
            const links = el.querySelectorAll("a");
            const plainText = textOnly(el.innerHTML);

            if (links.length > 0 && plainText) {
              const cleanedHtml = cleanHtmlPreserveLinks(el);
              if (cleanedHtml) {
                raw.push({ type: "p-html", html: cleanedHtml, id: genId() });
              }
            } else if (plainText) {
              raw.push({ type: "p", text: plainText, id: genId() });
            }
          }
          continue;
        }

        // Recurse for other containers
        walk(child);
      }
    }

    walk(doc.body);
    return postProcess(raw);
  }

  // ─── POST-PROCESSING (파싱 후 정리) ───────────────────
  function postProcess(blocks: Block[]): Block[] {
    const result: Block[] = [];

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const text = (block.text || "").trim();

      // 빈 블록 스킵
      if (
        !text &&
        block.type !== "image" &&
        block.type !== "table" &&
        block.type !== "ul" &&
        block.type !== "ol" &&
        block.type !== "p-html"
      ) {
        continue;
      }

      // "—" 만 있는 구분선 스킵
      if (block.type === "p" && /^[—–\-]+$/.test(text)) {
        continue;
      }

      // 1) "alt-text:" 패턴 → 직전 이미지의 alt에 삽입하고 이 블록 제거
      if (block.type === "p" && detectMetaPattern(text) === "alt-text") {
        const altValue = text.replace(/^alt[\-\s]?text\s*[:：]\s*/i, "").trim();
        // 직전 이미지 블록 찾기
        for (let j = result.length - 1; j >= 0; j--) {
          if (result[j].type === "image") {
            result[j].alt = altValue;
            break;
          }
        }
        continue; // 이 블록은 제거
      }

      // 2) "이미지 파일명:" 패턴 → 제거
      if (block.type === "p" && detectMetaPattern(text) === "filename") {
        continue;
      }

      // 3) 내부 메모 패턴 → 제거 (타겟 쿼리 등)
      if (block.type === "p" && detectMetaPattern(text) === "internal-memo") {
        continue;
      }
      // "정의쿼리-", "주 의도 쿼리-", "하위쿼리-" 로 시작하는 줄도 제거
      if (block.type === "p" && /^(정의|주\s*의도|하위)\s*쿼리/i.test(text)) {
        continue;
      }

      // 4) 제목 후보 감지: <p>인데 짧고 제목처럼 보이는 것
      if (block.type === "p" && isLikelyHeading(text)) {
        // 다음 블록이 긴 본문이거나, 리스트거나, 이미지면 → h2로 승격
        const next = blocks[i + 1];
        const nextIsBody =
          next &&
          ((next.type === "p" && (next.text || "").length > 60) ||
            next.type === "ul" ||
            next.type === "ol" ||
            next.type === "image" ||
            next.type === "table" ||
            next.type === "p-html");

        // "비교", "요약" 등 표 관련 키워드가 있으면 table-heading으로
        const isTableHeading = /비교|요약|정리|한눈에/i.test(text);

        if (isTableHeading) {
          result.push({ type: "table-heading", text, id: block.id });
          continue;
        }

        if (nextIsBody) {
          result.push({ type: "h2", text, id: block.id });
          continue;
        }
      }

      // 5) 번호 패턴 소제목 감지: "1. AI는 '의미'로...", "2. 문맥 해석..." (짧은 것)
      if (block.type === "p" && /^\d+\.\s/.test(text) && text.length < 40) {
        result.push({ type: "h3", text: text, id: block.id });
        continue;
      }

      // 6) 일반 블록은 그대로 추가
      result.push(block);
    }

    // 두 번째 패스: 연속된 같은 타입 ul 합치기 (구글독스가 ul을 개별로 쪼개는 문제)
    const merged: Block[] = [];
    for (const block of result) {
      const prev = merged[merged.length - 1];
      if (prev && prev.type === "ul" && block.type === "ul") {
        prev.items = [...(prev.items || []), ...(block.items || [])];
        continue;
      }
      if (prev && prev.type === "ol" && block.type === "ol") {
        prev.items = [...(prev.items || []), ...(block.items || [])];
        continue;
      }
      merged.push(block);
    }

    // 세 번째 패스: table-heading 뒤 연속 짧은 p 블록들을 table로 변환
    // 구글독스에서 표가 <table> 없이 개별 <p>로 들어오는 문제 해결
    const withTables: Block[] = [];
    for (let i = 0; i < merged.length; i++) {
      const block = merged[i];

      // table-heading 뒤에 짧은 p가 연속으로 나오면 표 데이터로 간주
      if (block.type === "table-heading") {
        // 다음 블록들에서 연속된 짧은 p 수집
        const cells: string[] = [];
        let j = i + 1;
        while (j < merged.length) {
          const next = merged[j];
          const nextText = (next.text || "").trim();
          // 짧은 p 블록 (200자 이하)이면 표 셀로 간주
          if (next.type === "p" && nextText && nextText.length <= 200) {
            cells.push(nextText);
            j++;
          } else {
            break;
          }
        }

        // 셀이 6개 이상이고 열 수를 추론할 수 있으면 table로 변환
        if (cells.length >= 6) {
          // 열 수 추론: 2~5열 시도, 나누어 떨어지는 가장 큰 열 수
          let numCols = 0;
          for (let c = 5; c >= 2; c--) {
            if (cells.length % c === 0) {
              numCols = c;
              break;
            }
          }

          if (numCols > 0) {
            // table HTML 생성
            const rows: string[][] = [];
            for (let k = 0; k < cells.length; k += numCols) {
              rows.push(cells.slice(k, k + numCols));
            }

            let tableHtml = "<table>";
            // 첫 행은 헤더
            tableHtml += "<thead><tr>";
            for (const cell of rows[0]) {
              tableHtml += `<th>${esc(cell)}</th>`;
            }
            tableHtml += "</tr></thead><tbody>";
            for (let r = 1; r < rows.length; r++) {
              tableHtml += "<tr>";
              for (const cell of rows[r]) {
                tableHtml += `<td>${esc(cell)}</td>`;
              }
              tableHtml += "</tr>";
            }
            tableHtml += "</tbody></table>";

            withTables.push(block); // table-heading 유지
            withTables.push({ type: "table", html: tableHtml, id: genId() });
            i = j - 1; // 소비한 p 블록들 건너뛰기
            continue;
          }
        }
      }

      withTables.push(block);
    }

    return withTables;
  }

  // ─── BLOCK OPERATIONS ─────────────────────────────────
  const updateBlock = (id: string, updates: Partial<Block>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    );
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (id: string, dir: number) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const addBlock = (afterId: string, type: BlockType) => {
    const newBlock: Block = { type, text: "", id: genId() };
    if (type === "image")
      Object.assign(newBlock, {
        src: "",
        alt: "",
        uploaded: false,
        ghostUrl: "",
      });
    if (type === "ul" || type === "ol") newBlock.items = [""];
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === afterId);
      const arr = [...prev];
      arr.splice(idx + 1, 0, newBlock);
      return arr;
    });
  };

  // ─── IMAGE FILE HANDLER ───────────────────────────────
  const handleImageFile = (id: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      updateBlock(id, { src: e.target?.result as string, uploaded: false });
    };
    reader.readAsDataURL(file);
  };

  // ─── GENERATE HTML (클라이언트 미리보기용) ────────────
  const generateHtml = (): string => {
    let body = "";
    for (const block of blocks) {
      switch (block.type) {
        case "h2":
          body += `\n    <h2 class="section-title">${esc(block.text || "")}</h2>\n`;
          break;
        case "h3":
          body += `\n    <h3 class="sub-title">${esc(block.text || "")}</h3>\n`;
          break;
        case "table-heading":
          body += `\n    <h3 class="table-heading">${esc(block.text || "")}</h3>\n`;
          break;
        case "p":
          body += `<p>${esc(block.text || "")}</p>\n`;
          break;
        case "p-html":
          body += `<p>${block.html || ""}</p>\n`;
          break;
        case "image": {
          const src = block.ghostUrl || block.src || "";
          body += ` <img src="${src}" alt="${esc(block.alt || "")}" style="width: 100%; height: auto; margin: 24px 0;" />\n`;
          break;
        }
        case "table": {
          const tableHtml = addStandardTableClass(block.html || "");
          body += `\n<div class="table-container">${tableHtml}</div>\n`;
          break;
        }
        case "ul":
          body += `<ul>\n${(block.items || []).map((i) => `      <li>${i}</li>`).join("\n")}\n    </ul>\n`;
          break;
        case "ol":
          body += `<ol>\n${(block.items || []).map((i) => `      <li>${i}</li>`).join("\n")}\n    </ol>\n`;
          break;
      }
    }
    return `<article class="simple-blog-wrapper">
<header class="blog-header"><div class="blog-meta"></div></header>
  <div class="is-narrow"></div>
  <div class="blog-body">
${body}
</div>
</article>`;
  };

  // ─── UPLOAD IMAGES via API route ──────────────────────
  const uploadImages = async (): Promise<Block[]> => {
    const updated = [...blocks];
    for (let i = 0; i < updated.length; i++) {
      const block = updated[i];
      if (block.type !== "image" || block.ghostUrl || !block.src) continue;

      try {
        // base64 → blob
        const res = await fetch(block.src);
        const blob = await res.blob();
        const formData = new FormData();
        formData.append("file", blob, `image-${block.id}.png`);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.url) {
          updated[i] = { ...block, ghostUrl: uploadData.url, uploaded: true };
        }
      } catch (err) {
        console.error("Image upload failed for block", block.id, err);
      }
    }
    setBlocks(updated);
    return updated;
  };

  // ─── PUBLISH via API route ────────────────────────────
  const handlePublish = async (status: "draft" | "published") => {
    if (!title.trim()) {
      setErrorMsg("제목을 입력해주세요");
      setTimeout(() => setErrorMsg(""), 3000);
      return;
    }

    setPublishStatus("uploading");
    setErrorMsg("");

    try {
      // 1. 이미지 업로드
      const updatedBlocks = await uploadImages();

      // 2. 서버 API로 발행
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          blocks: updatedBlocks,
          status,
          metaDescription: metaDesc,
          metaTitle: metaTitle || undefined,
          canonicalUrl: canonicalUrl || undefined,
          slug: postSlug.trim() || undefined,
          // author: author || undefined,
          tags: tags.split(",").filter((t) => t.trim()),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPublishStatus(status === "draft" ? "draft_ok" : "published_ok");
      } else {
        setPublishStatus("error");
        setErrorMsg(data.error || "발행 실패");
      }
    } catch (err: any) {
      setPublishStatus("error");
      setErrorMsg(err.message || "네트워크 오류");
    }
  };

  // ─── COPY HTML ────────────────────────────────────────
  const copyHtml = () => {
    navigator.clipboard.writeText(generateHtml());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── RESET ────────────────────────────────────────────
  const reset = () => {
    setBlocks([]);
    setTitle("");
    setPostSlug("");
    setMetaDesc("");
    setMetaTitle("");
    setCanonicalUrl("");
    //  setAuthor("");
    setTags("");
    setPublishStatus(null);
    setErrorMsg("");
    setShowHtmlModal(false);
    setCopied(false);
    setDragOver(false);
    setStep("input");
  };

  // ─── RENDER ───────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* ── Header ── */}
      <header
        style={{
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>
              B
            </span>
          </div>
          {step !== "input" && <BackButton onClick={reset} />}
          <span style={{ fontWeight: 700, fontSize: 17, color: "#0f172a" }}>
            Blog Converter
          </span>
          <span
            style={{
              fontSize: 11,
              color: "#94a3b8",
              background: "#f1f5f9",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            ARTIENCE
          </span>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {step !== "input" && (
            <>
              <HeaderBtn
                onClick={() => setStep("edit")}
                active={step === "edit"}
              >
                편집
              </HeaderBtn>
              <HeaderBtn
                onClick={() => setStep("preview")}
                active={step === "preview"}
              >
                미리보기
              </HeaderBtn>
              <HeaderBtn onClick={() => setShowHtmlModal(true)}>
                HTML 복사
              </HeaderBtn>
              <HeaderBtn onClick={reset} style={{ color: "#ef4444" }}>
                초기화
              </HeaderBtn>
            </>
          )}
        </div>
      </header>

      {/* ── HTML Copy Modal ── */}
      {showHtmlModal && (
        <Modal onClose={() => setShowHtmlModal(false)}>
          <h3 style={{ margin: "0 0 12px", color: "#0f172a", fontSize: 16 }}>
            생성된 HTML
          </h3>
          <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>
            Ghost 에디터의 HTML 카드에 붙여넣으세요.
          </p>
          <textarea
            readOnly
            value={generateHtml()}
            style={{
              width: "100%",
              height: 300,
              fontFamily: "monospace",
              fontSize: 12,
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: 12,
              background: "#f8fafc",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={copyHtml}
            style={{ ...primaryBtnStyle, width: "100%", marginTop: 12 }}
          >
            {copied ? "✓ 복사됨!" : "클립보드에 복사"}
          </button>
        </Modal>
      )}

      {/* ── Main ── */}
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px" }}>
        {/* ── Step: Input ── */}
        {step === "input" && (
          <div
            ref={pasteRef}
            onPaste={handlePaste}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            tabIndex={0}
            style={{
              border: `2px dashed ${dragOver ? "#1e3a8a" : "#cbd5e1"}`,
              borderRadius: 16,
              padding: "80px 40px",
              textAlign: "center",
              cursor: "text",
              background: dragOver ? "#eff6ff" : "#fff",
              transition: "all 0.2s",
              outline: "none",
              minHeight: 420,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "#eff6ff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <span style={{ fontSize: 32 }}>📋</span>
            </div>
            <h2
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              글 본문을 복사해서 붙여넣으세요
            </h2>
            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: 15,
                lineHeight: 1.6,
                maxWidth: 460,
              }}
            >
              제목은 별도로 입력합니다.
              <br />
              <strong>제목 아래 본문부터</strong> 선택 → Ctrl+C → 이 영역 클릭 →
              Ctrl+V
              <br />
              이미지, 표, 링크가 자동 인식됩니다.
            </p>
            <div
              style={{
                marginTop: 16,
                padding: "12px 20px",
                background: "#f8fafc",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: 13, color: "#64748b" }}>
                💡 마크다운(#, ##, ###)도 자동 인식
              </span>
            </div>
          </div>
        )}

        {/* ── Step: Edit ── */}
        {step === "edit" && (
          <div>
            {/* Post Meta */}
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                padding: 24,
                marginBottom: 20,
                border: "1px solid #e2e8f0",
              }}
            >
              <label style={labelStyle}>글 제목 *</label>
              <input
                style={{ ...inputStyle, fontSize: 18, fontWeight: 700 }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="블로그 제목을 입력하세요"
              />
              <label style={labelStyle}>글 URL (Post Slug)</label>
              <input
                style={inputStyle}
                value={postSlug}
                onChange={(e) => setPostSlug(toPostSlug(e.target.value))}
                placeholder="my-post-slug (비워두면 Ghost가 제목에서 자동 생성)"
              />
              <label style={labelStyle}>작성자</label>
              {/* <input
                style={inputStyle}
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="작성자 이름"
              /> */}
              <label style={labelStyle}>Meta Title</label>
              <input
                style={inputStyle}
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                placeholder="검색 결과에 표시될 제목 (비워두면 글 제목 사용)"
              />
              <label style={labelStyle}>Meta Description</label>
              <input
                style={inputStyle}
                value={metaDesc}
                onChange={(e) => setMetaDesc(e.target.value)}
                placeholder="검색 결과에 표시될 설명"
              />
              <label style={labelStyle}>Canonical URL</label>
              <input
                style={inputStyle}
                value={canonicalUrl}
                onChange={(e) => setCanonicalUrl(e.target.value)}
                placeholder="https://www.artience.com/blog/url"
              />
              <label style={labelStyle}>태그 (쉼표로 구분)</label>
              <input
                style={inputStyle}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="SEO/GEO, AI 검색, GEO"
              />
            </div>

            {/* Blocks */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: "#64748b" }}>
                콘텐츠 블록 ({blocks.length}개)
              </span>
            </div>

            {blocks.map((block, i) => (
              <BlockEditor
                key={block.id}
                block={block}
                index={i}
                total={blocks.length}
                onUpdate={(updates) => updateBlock(block.id, updates)}
                onRemove={() => removeBlock(block.id)}
                onMove={(dir) => moveBlock(block.id, dir)}
                onAdd={(type) => addBlock(block.id, type)}
                onImageFile={(file) => handleImageFile(block.id, file)}
              />
            ))}

            {/* Publish buttons */}
            {blocks.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  marginTop: 28,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={() => handlePublish("draft")}
                  style={{
                    ...primaryBtnStyle,
                    padding: "14px 36px",
                    fontSize: 15,
                  }}
                >
                  Ghost 초안 저장
                </button>
                <button
                  onClick={() => handlePublish("published")}
                  style={{
                    ...primaryBtnStyle,
                    background: "#16a34a",
                    padding: "14px 36px",
                    fontSize: 15,
                  }}
                >
                  바로 발행
                </button>
              </div>
            )}

            {/* Status */}
            <StatusBar status={publishStatus} errorMsg={errorMsg} />
          </div>
        )}

        {/* ── Step: Preview ── */}
        {step === "preview" && (
          <div>
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                padding: "40px 0",
                overflow: "hidden",
              }}
            >
              <style>{PREVIEW_STYLE}</style>
              {title.trim() && (
                <div
                  style={{
                    maxWidth: 780,
                    margin: "0 auto",
                    padding: "0 20px",
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Pretendard", sans-serif',
                  }}
                >
                  <h1
                    style={{
                      fontSize: "2rem",
                      fontWeight: 800,
                      color: "#0f172a",
                      lineHeight: 1.3,
                      // marginBottom: author.trim() ? 8 : 0,
                    }}
                  >
                    {title}
                  </h1>
                  {/* {author.trim() && (
                    <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                      {author}
                    </p>
                  )} */}
                </div>
              )}
              <div dangerouslySetInnerHTML={{ __html: generateHtml() }} />
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                marginTop: 24,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => setStep("edit")}
                style={{ ...secondaryBtnStyle }}
              >
                ← 편집으로
              </button>
              <button
                onClick={() => handlePublish("draft")}
                style={{ ...primaryBtnStyle }}
              >
                Ghost 초안 저장
              </button>
              <button
                onClick={() => handlePublish("published")}
                style={{ ...primaryBtnStyle, background: "#16a34a" }}
              >
                바로 발행
              </button>
            </div>
            <StatusBar status={publishStatus} errorMsg={errorMsg} />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── BLOCK EDITOR ───────────────────────────────────────
function BlockEditor({
  block,
  index,
  total,
  onUpdate,
  onRemove,
  onMove,
  onAdd,
  onImageFile,
}: {
  block: Block;
  index: number;
  total: number;
  onUpdate: (u: Partial<Block>) => void;
  onRemove: () => void;
  onMove: (dir: number) => void;
  onAdd: (type: BlockType) => void;
  onImageFile: (file: File) => void;
}) {
  const typeLabels: Record<string, string> = {
    h2: "대제목 (H2)",
    h3: "소제목 (H3)",
    "table-heading": "표 제목",
    p: "본문",
    "p-html": "본문 (링크)",
    image: "이미지",
    table: "표",
    ul: "리스트",
    ol: "번호 리스트",
  };

  const typeColors: Record<string, string> = {
    h2: "#1e3a8a",
    h3: "#334155",
    "table-heading": "#1e3a8a",
    p: "#64748b",
    "p-html": "#64748b",
    image: "#d97706",
    table: "#7c3aed",
    ul: "#64748b",
    ol: "#64748b",
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 10,
        border: "1px solid #e2e8f0",
        padding: 16,
        marginBottom: 6,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select
            value={block.type}
            onChange={(e) => onUpdate({ type: e.target.value as BlockType })}
            style={{
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: "3px 8px",
              color: typeColors[block.type] || "#64748b",
              background: "#f8fafc",
              cursor: "pointer",
            }}
          >
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>#{index + 1}</span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          <SmallBtn
            onClick={() => onMove(-1)}
            disabled={index === 0}
            style={{ width: "auto", padding: "0 6px", fontSize: 11 }}
          >
            위
          </SmallBtn>
          <SmallBtn
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            style={{ width: "auto", padding: "0 6px", fontSize: 11 }}
          >
            아래
          </SmallBtn>
          <SmallBtn
            onClick={onRemove}
            style={{
              color: "#ef4444",
              width: "auto",
              padding: "0 6px",
              fontSize: 11,
            }}
          >
            삭제
          </SmallBtn>
        </div>
      </div>

      {/* Content by type */}
      {["h2", "h3", "table-heading", "p"].includes(block.type) && (
        <textarea
          value={block.text || ""}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder={
            block.type === "p" ? "본문을 입력하세요..." : "제목을 입력하세요..."
          }
          style={{
            width: "100%",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: 10,
            fontSize: block.type === "h2" ? 17 : block.type === "h3" ? 15 : 14,
            fontWeight: block.type === "p" ? 400 : 700,
            color: typeColors[block.type],
            minHeight: block.type === "p" ? 80 : 40,
            resize: "vertical",
            fontFamily: "inherit",
            lineHeight: 1.6,
            boxSizing: "border-box",
          }}
        />
      )}

      {block.type === "p-html" && (
        <div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
            링크 포함 블록 (HTML 편집)
          </div>
          <textarea
            value={block.html || ""}
            onChange={(e) => onUpdate({ html: e.target.value })}
            style={{
              width: "100%",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: 10,
              fontSize: 13,
              fontFamily: "monospace",
              minHeight: 80,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {block.type === "image" && (
        <div>
          {block.src ? (
            <div>
              <img
                src={block.src}
                alt={block.alt || ""}
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  borderRadius: 6,
                  marginBottom: 8,
                  objectFit: "contain",
                  background: "#f1f5f9",
                }}
              />
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                {block.uploaded && (
                  <span
                    style={{ fontSize: 11, color: "#16a34a", fontWeight: 600 }}
                  >
                    ✓ Ghost 업로드 완료
                  </span>
                )}
                <button
                  onClick={() =>
                    onUpdate({ src: "", ghostUrl: "", uploaded: false })
                  }
                  style={{
                    fontSize: 11,
                    color: "#ef4444",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  이미지 변경
                </button>
              </div>
            </div>
          ) : (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 100,
                border: "2px dashed #cbd5e1",
                borderRadius: 8,
                cursor: "pointer",
                color: "#94a3b8",
                fontSize: 14,
                background: "#f8fafc",
              }}
            >
              📁 이미지를 선택하세요
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImageFile(f);
                }}
              />
            </label>
          )}
          <input
            value={block.alt || ""}
            onChange={(e) => onUpdate({ alt: e.target.value })}
            placeholder="이미지 alt 텍스트"
            style={{ ...inputStyle, fontSize: 13, marginTop: 6 }}
          />
        </div>
      )}

      {block.type === "table" && (
        <textarea
          value={block.html || ""}
          onChange={(e) => onUpdate({ html: e.target.value })}
          style={{
            width: "100%",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            padding: 10,
            fontSize: 12,
            fontFamily: "monospace",
            minHeight: 100,
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      )}

      {(block.type === "ul" || block.type === "ol") && (
        <div>
          {(block.items || []).map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                marginBottom: 4,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: "#94a3b8",
                  minWidth: 20,
                  textAlign: "right",
                }}
              >
                {block.type === "ol" ? `${i + 1}.` : "•"}
              </span>
              <input
                value={item}
                onChange={(e) => {
                  const newItems = [...(block.items || [])];
                  newItems[i] = e.target.value;
                  onUpdate({ items: newItems });
                }}
                style={{
                  flex: 1,
                  border: "1px solid #e2e8f0",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 13,
                }}
              />
              <SmallBtn
                onClick={() => {
                  const newItems = (block.items || []).filter(
                    (_, idx) => idx !== i,
                  );
                  onUpdate({ items: newItems });
                }}
                style={{
                  color: "#ef4444",
                  width: "auto",
                  height: 24,
                  fontSize: 11,
                  padding: "0 4px",
                }}
              >
                삭제
              </SmallBtn>
            </div>
          ))}
          <button
            onClick={() => onUpdate({ items: [...(block.items || []), ""] })}
            style={{
              fontSize: 11,
              color: "#1e3a8a",
              background: "none",
              border: "1px dashed #cbd5e1",
              borderRadius: 4,
              padding: "3px 10px",
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            + 항목 추가
          </button>
        </div>
      )}

      {/* Add block buttons */}
      <div style={{ display: "flex", gap: 4, marginTop: 10, flexWrap: "wrap" }}>
        {(
          [
            ["p", "+ 본문"],
            ["h2", "+ 대제목"],
            ["h3", "+ 소제목"],
            ["image", "+ 이미지"],
            ["table-heading", "+ 표 제목"],
          ] as [BlockType, string][]
        ).map(([type, label]) => (
          <button
            key={type}
            onClick={() => onAdd(type)}
            style={{
              fontSize: 11,
              color: "#64748b",
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 4,
              padding: "3px 8px",
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── STATUS BAR ─────────────────────────────────────────
function StatusBar({
  status,
  errorMsg,
}: {
  status: PublishStatus;
  errorMsg: string;
}) {
  if (!status) return null;

  const bg = status.includes("ok")
    ? "#f0fdf4"
    : status === "error"
      ? "#fef2f2"
      : "#eff6ff";
  const color = status.includes("ok")
    ? "#16a34a"
    : status === "error"
      ? "#dc2626"
      : "#1e3a8a";

  return (
    <div
      style={{
        textAlign: "center",
        marginTop: 16,
        padding: "12px 20px",
        borderRadius: 8,
        background: bg,
        color,
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      {status === "uploading" && "⏳ 이미지 업로드 & 발행 중..."}
      {status === "draft_ok" && "✅ Ghost에 초안으로 저장되었습니다!"}
      {status === "published_ok" && "✅ 발행 완료!"}
      {status === "error" &&
        `❌ ${errorMsg || "발행 실패 — .env.local의 Ghost 설정을 확인해주세요"}`}
    </div>
  );
}

// ─── SHARED UI ──────────────────────────────────────────
function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="처음으로 돌아가기"
      aria-label="처음으로 돌아가기"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: 8,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        color: "#475569",
        padding: 0,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#f1f5f9";
        e.currentTarget.style.color = "#0f172a";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.color = "#475569";
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 12H5" />
        <path d="M12 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

function HeaderBtn({
  children,
  active,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      style={{
        padding: "7px 14px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        fontWeight: 600,
        transition: "all 0.15s",
        background: active ? "#1e3a8a" : "#f8fafc",
        color: active ? "#fff" : "#334155",
        border: active ? "1px solid #1e3a8a" : "1px solid #e2e8f0",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function SmallBtn({
  children,
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: "1px solid #e2e8f0",
        background: "#fff",
        cursor: "pointer",
        fontSize: 13,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          maxWidth: 560,
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── STYLES ─────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 4,
  marginTop: 12,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "10px 24px",
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
  background: "#1e3a8a",
  color: "#fff",
  transition: "all 0.15s",
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: "#f1f5f9",
  color: "#334155",
  border: "1px solid #e2e8f0",
};
