pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

export class PDFViewer {
    constructor(container, panel) {
        this.container = container;
        this.panel = panel;
        this.pdfDoc = null;
        this.currentPageNumber = -1;
    }

    async loadDocument(arrayBuffer) {
        this.pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        return this.pdfDoc;
    }

    async renderPage(pageNum, onSpanClickCallback) {
        this.currentPageNumber = pageNum;
        this.container.innerHTML = "";

        const page = await this.pdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });

        // Chiều rộng khả dụng sau khi trừ lề 2 bên (padding 40px mỗi bên = 80px)
        const availableWidth = this.panel.clientWidth - 300;
        const fitScale = availableWidth / unscaledViewport.width;

        const viewport = page.getViewport({ scale: fitScale });

        const pageWrapper = document.createElement("div");
        pageWrapper.className = "page-wrapper";
        pageWrapper.id = "active-pdf-page";
        pageWrapper.style.width = `${viewport.width}px`;
        pageWrapper.style.height = `${viewport.height}px`;

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        const textLayerDiv = document.createElement("div");
        textLayerDiv.className = "textLayer";
        textLayerDiv.style.width = `${viewport.width}px`;
        textLayerDiv.style.height = `${viewport.height}px`;

        const textContent = await page.getTextContent();
        const renderTask = pdfjsLib.renderTextLayer({
            textContentSource: textContent,
            container: textLayerDiv,
            viewport: viewport,
            textDivs: []
        });

        if (renderTask.promise) {
            await renderTask.promise;
        }

        // Gắn DOM index cho từng span
        const spans = textLayerDiv.querySelectorAll('span');
        spans.forEach((span, idx) => {
            span.setAttribute('data-span-index', idx);
        });

        if (onSpanClickCallback) {
            textLayerDiv.addEventListener('click', (event) => {
                if (event.target && event.target.tagName === 'SPAN') {
                    const spanIdx = parseInt(event.target.getAttribute('data-span-index'));
                    onSpanClickCallback(spanIdx, event.target.textContent);
                }
            });
        }

        pageWrapper.appendChild(canvas);
        pageWrapper.appendChild(textLayerDiv);
        this.container.appendChild(pageWrapper);
    }
}