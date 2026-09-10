export function cleanText(rawText) {
  let text = rawText.replace(/\r\n?/g, "\n");

  // Remove HTML tags
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "");
  text = text.replace(/<\/?(?:p|div|h[1-6]|li|blockquote)\b[^>]*>/gi, "\n\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/?[A-Za-z][^>]*>/g, " ");

  // Remove markdown images: ![alt](url)
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, "");

  // Remove markdown links but keep label: [label](url) → label
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");

  // Remove standalone URLs
  text = text.replace(/https?:\/\/[^\s)>\]]+/g, "");

  // Remove citation brackets like [1], [2,3], [citation needed]
  text = text.replace(/\[\d+(?:[,\s]+\d+)*\]/g, "");
  text = text.replace(/\[citation needed\]/gi, "");

  // Remove markdown bold/italic markers
  text = text.replace(/(\*{1,3}|_{1,3})(.*?)\1/g, "$2");

  // Remove markdown headings markers (keep text)
  text = text.replace(/^#{1,6}\s+/gm, "");

  // Remove markdown horizontal rules
  text = text.replace(/^[-*_]{3,}\s*$/gm, "");

  // Remove markdown code fences
  text = text.replace(/```[\s\S]*?```/g, "");
  text = text.replace(/`([^`]+)`/g, "$1");

  // Decode common HTML entities
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, " ");

  // Remove pipe-separated navigation menus (e.g. "Home | News | Sport | ...")
  // Only removes the pipe-delimited segments themselves, not what follows the last pipe
  text = text.replace(/(?:[^|.!?\n]{1,40}\|){2,}/g, " ");

  // Remove nav items before the first pipe: only when a pipe-delimited nav structure
  // is present on the same line (gated by lookahead for a pipe within 120 chars)
  text = text.replace(/^(?:[A-ZÜÄÖÉÀÂÊÎÔÛÄÖ][^\s.!?|]{0,25}\s+){5,}(?=[^\n]{0,120}\|)/m, " ");

  // Match complete date/time alternatives before the legacy numeric marker.
  text = text.replace(
    /\bPubliziert[ \t]*(?:(?:\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\.[ \t]*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)[ \t]*\d{4})(?:[, \t]*\d{1,2}:\d{2})?|\d{1,2}:\d{2}|\d+\.)?[ \t]*/gi,
    " "
  );

  // Remove timestamps only when they appear in metadata context:
  // immediately following an explicit date pattern (not standalone in sentences)
  text = text.replace(
    /(?:\d{1,2}\.\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s*\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}|\d{1,2}\.\d{1,2}\.\d{2,4})[,\s]*\s*\d{1,2}:\d{2}\b/gi,
    (m) => m.replace(/\b\d{1,2}:\d{2}\b/, " ")
  );

  // Remove social/share metadata: patterns like "Firstname Lastname 123 45 Merken"
  text = text.replace(/\b\d+\s+\d+\s+(?:Merken|Share|Like|Teilen|Views?|Comments?)\b/gi, " ");

  // Collapse excessive whitespace
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.split("\n").map((line) => line.trim()).join("\n").replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

export function splitSections(cleanedText) {
  let chunks = cleanedText
    .split(/\n\s*\n+/)
    .map((chunk) => chunk.split("\n").map((line) => line.trim()).filter(Boolean).join(" "))
    .map((chunk) => chunk.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  // Split at boundaries instead of matching fragments, so dates, decimals,
  // and an unpunctuated tail cannot be skipped or duplicated.
  chunks = chunks.flatMap((chunk) => {
    if (chunk.split(/\s+/).length <= 200) return [chunk];
    const sentences = chunk.split(/(?<!\d\.)(?<=[.!?])\s+/);
    const result = [];
    let words = [];
    for (const sentence of sentences) {
      const next = sentence.split(/\s+/);
      if (words.length && words.length + next.length > 200) {
        result.push(words.join(" "));
        words = [];
      }
      // Bound each append: spreading a whole pasted document can exceed the
      // engine's argument limit, and repeatedly splicing it is quadratic.
      for (let offset = 0; offset < next.length; offset += 200) {
        const part = next.slice(offset, offset + 200);
        if (words.length && words.length + part.length > 200) {
          result.push(words.join(" "));
          words = [];
        }
        words.push(...part);
      }
    }
    if (words.length) result.push(words.join(" "));
    return result;
  });

  return chunks.map((text) => {
    const words = text.split(/\s+/).filter(Boolean);
    const looksLikeHeading =
      words.length <= 12 &&
      text.length <= 90 &&
      !/[.!?]$/.test(text) &&
      text === text.trim();

    return {
      type: looksLikeHeading ? "heading" : "paragraph",
      text,
      wordCount: words.length,
    };
  });
}

