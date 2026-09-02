/**
 * Chuẩn hóa chuỗi văn bản phục vụ so khớp:
 * Chuyển chữ thường, đưa về NFC, lọc sạch dấu câu và ký tự rác.
 */
export function normalizeText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFC')
        .replace(/[\(\[]\s*\d+\s*[\)\]]/g, '') // Bỏ footnote (1), (2)
        .replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '')        // Bỏ số mũ
        .replace(/[^a-z0-9à-ỹá-ỵ]/gi, '')      // Chỉ giữ ký tự chữ và số liền mạch
        .trim();
}

/**
 * Tô sáng câu đang đọc (Chuẩn hóa độc lập cho cả PDF và Word)
 */
export function highlightSentence(sentenceText, sentenceIndex = -1) {
    // 1. Xóa sạch mọi highlight cũ
    document.querySelectorAll('.active-highlight').forEach(el => {
        el.classList.remove('active-highlight');
        if (el.tagName === 'MARK') {
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
        }
    });

    if (!sentenceText || !sentenceText.trim()) return;

    // =========================================================
    // TRƯỜNG HỢP 1: TÀI LIỆU WORD (DOCX)
    // =========================================================
    const isDocx = document.querySelector('.docxTextLayer') !== null;
    if (isDocx) {
        const container = document.querySelector('.docxTextLayer');
        if (!container) return;

        const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        const textNodes = [];
        let fullDocText = "";
        let node;

        while ((node = walker.nextNode())) {
            const val = node.nodeValue;
            if (!val || !val.trim()) continue;
            const start = fullDocText.length;
            fullDocText += val;
            textNodes.push({ node, start, end: start + val.length });
        }

        const headSample = sentenceText.trim().slice(0, Math.min(25, sentenceText.trim().length));
        let realStart = fullDocText.indexOf(headSample);

        if (realStart === -1) {
            const normFull = normalizeText(fullDocText);
            const normTarget = normalizeText(sentenceText).slice(0, 25);
            realStart = normFull.indexOf(normTarget);
        }

        if (realStart === -1) return;
        const realEnd = Math.min(fullDocText.length, realStart + sentenceText.trim().length);

        let firstMark = null;
        for (let i = textNodes.length - 1; i >= 0; i--) {
            const item = textNodes[i];
            if (item.end > realStart && item.start < realEnd) {
                const sOffset = Math.max(0, realStart - item.start);
                const eOffset = Math.min(item.node.nodeValue.length, realEnd - item.start);

                if (sOffset < eOffset) {
                    try {
                        const range = document.createRange();
                        range.setStart(item.node, sOffset);
                        range.setEnd(item.node, eOffset);

                        const mark = document.createElement('mark');
                        mark.className = 'active-highlight';
                        range.surroundContents(mark);
                        firstMark = mark;
                    } catch (err) {}
                }
            }
        }

        if (firstMark) {
            firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }

    // =========================================================
    // TRƯỜNG HỢP 2: TÀI LIỆU PDF (Duyệt theo tọa độ ký tự tuyệt đối)
    // =========================================================
    const rawSpans = Array.from(document.querySelectorAll('#active-pdf-page .textLayer span'));
    const pdfSpans = rawSpans.filter(s => s.textContent && s.textContent.trim().length > 0);
    if (!pdfSpans.length) return;

    // 2.1. Tạo dòng ký tự liên tục từ tất cả span trên trang
    let pageCharStream = "";
    const spanCharMap = [];

    pdfSpans.forEach(span => {
        const norm = normalizeText(span.textContent);
        const start = pageCharStream.length;
        pageCharStream += norm;
        const end = pageCharStream.length;

        spanCharMap.push({
            span,
            start,
            end,
            length: norm.length
        });
    });

    const targetNorm = normalizeText(sentenceText);
    if (!targetNorm) return;

    // 2.2. Tìm vị trí xuất hiện của targetNorm trên dòng ký tự
    let matchStart = pageCharStream.indexOf(targetNorm);

    // Nếu không khớp trọn vẹn (do dấu gạch ngang nối từ ở mép dòng): thử tìm theo đoạn đầu
    if (matchStart === -1) {
        for (let len = Math.min(35, targetNorm.length); len >= 10; len -= 5) {
            const sub = targetNorm.slice(0, len);
            const pos = pageCharStream.indexOf(sub);
            if (pos !== -1) {
                matchStart = pos;
                break;
            }
        }
    }

    // Fallback: Tìm theo đoạn giữa câu
    if (matchStart === -1 && targetNorm.length > 25) {
        const midSample = targetNorm.slice(10, 30);
        const pos = pageCharStream.indexOf(midSample);
        if (pos !== -1) {
            matchStart = Math.max(0, pos - 10);
        }
    }

    if (matchStart === -1) return;

    const matchEnd = matchStart + targetNorm.length;
    let firstSpan = null;

    // 2.3. Bôi màu tất cả các span nằm trong phạm vi từ matchStart đến matchEnd
    spanCharMap.forEach(item => {
        if (item.length > 0) {
            const isOverlap = item.start < matchEnd && item.end > matchStart;
            if (isOverlap) {
                item.span.classList.add('active-highlight');
                if (!firstSpan) firstSpan = item.span;
            }
        }
    });

    if (firstSpan) {
        firstSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}