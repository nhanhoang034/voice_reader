import { normalizeText } from './highlighter.js';

export async function renderDocxToContainer(arrayBuffer, container, sentenceItems, onSentenceSelect) {
    container.innerHTML = "";
    const res = await window.mammoth.convertToHtml({ arrayBuffer });

    const pageWrapper = document.createElement("div");
    pageWrapper.className = "page-wrapper docx-wrapper";
    pageWrapper.id = "active-pdf-page";

    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "textLayer docxTextLayer";
    textLayerDiv.innerHTML = res.value;

    // Bắt sự kiện click chính xác tại vị trí con trỏ chuột bên trong đoạn văn
    textLayerDiv.addEventListener("click", (event) => {
        const targetBlock = event.target.closest("p, li, h1, h2, h3, h4, h5, h6") || event.target;
        if (!targetBlock) return;

        let clickedOffsetInBlock = 0;
        let isOffsetFound = false;

        let range = null;
        if (document.caretRangeFromPoint) {
            range = document.caretRangeFromPoint(event.clientX, event.clientY);
        } else if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
            if (pos) {
                range = document.createRange();
                range.setStart(pos.offsetNode, pos.offset);
            }
        }

        if (range && targetBlock.contains(range.startContainer)) {
            const preCaretRange = document.createRange();
            preCaretRange.selectNodeContents(targetBlock);
            preCaretRange.setEnd(range.startContainer, range.startOffset);
            clickedOffsetInBlock = preCaretRange.toString().length;
            isOffsetFound = true;
        }

        const blockText = targetBlock.textContent || "";
        if (!blockText.trim()) return;

        // Lấy đoạn snippet ngữ cảnh quanh điểm click (khoảng 40 ký tự trước và sau)
        let snippet = "";
        if (isOffsetFound) {
            const start = Math.max(0, clickedOffsetInBlock - 40);
            const end = Math.min(blockText.length, clickedOffsetInBlock + 40);
            snippet = blockText.slice(start, end);
        } else {
            snippet = blockText;
        }

        const normSnippet = normalizeText(snippet);
        if (!normSnippet) return;

        // So khớp tìm chính xác câu chứa từ bạn vừa bấm vào
        let matchedIndex = sentenceItems.findIndex(item => {
            const normItem = normalizeText(item.text);
            return normItem.includes(normSnippet) || normSnippet.includes(normItem);
        });

        if (matchedIndex === -1) {
            const words = normSnippet.split(' ').filter(w => w.length > 2);
            let bestMatch = -1;
            let maxScore = 0;

            sentenceItems.forEach((item, idx) => {
                const normItem = normalizeText(item.text);
                let score = 0;
                words.forEach(w => {
                    if (normItem.includes(w)) score++;
                });

                if (score > maxScore && score >= 2) {
                    maxScore = score;
                    bestMatch = idx;
                }
            });

            matchedIndex = bestMatch;
        }

        if (matchedIndex !== -1 && typeof onSentenceSelect === 'function') {
            onSentenceSelect(matchedIndex);
        }
    });

    pageWrapper.appendChild(textLayerDiv);
    container.appendChild(pageWrapper);
}