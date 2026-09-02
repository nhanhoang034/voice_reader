import { PDFViewer } from './pdf_viewer.js';
import { normalizeText, highlightSentence } from './highlighter.js';
import { AudioPlayer } from './audio_player.js';
import { initCustomSelect, setupUIHelpers } from './ui.js';
import { renderDocxToContainer } from './docx_renderer.js';

// DOM Elements
const pdfFileInput = document.getElementById('pdfFile');
const btnRead = document.getElementById('btnRead');
const btnStop = document.getElementById('btnStop');
const pdfContainer = document.getElementById('pdfViewerContainer');
const pdfPanel = document.getElementById('pdfPanel');
const paginationBar = document.getElementById('paginationBar');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');
const pageNumberInput = document.getElementById('pageNumberInput');
const pageCountLabel = document.getElementById('pageCountLabel');

// Setup
const { showLoading, hideLoading } = setupUIHelpers(document.getElementById('loadingIndicator'));
const viewer = new PDFViewer(pdfContainer, pdfPanel);
const player = new AudioPlayer();

let sentenceItems = [];
let currentIndex = 0;
let isPlaying = false;
let pdfDoc = null;
let currentFileType = 'pdf';
let currentVoice = "vi-VN-HoaiMyNeural";
let currentSpeed = "1.25";

// Bản đồ tra cứu nhanh vị trí span cho trang PDF hiện tại
let pdfSpanSentenceMap = new Map();

// Cài đặt Dropdown
initCustomSelect('customVoiceSelect', 'voiceSelectedLabel', 'voiceOptions', (val) => {
    if (currentVoice === val) return;
    currentVoice = val;
    player.clearCache();
    if (isPlaying && sentenceItems.length > 0) {
        player.stop();
        playSentence(currentIndex);
    }
});

initCustomSelect('customSpeedSelect', 'speedSelectedLabel', 'speedOptions', (val) => {
    currentSpeed = val;
    player.setPlaybackRate(val);
});

function setPlayState(playing) {
    isPlaying = playing;
    btnRead.disabled = playing;
    btnStop.disabled = !playing;
    if (!playing) hideLoading();
}

// Chuyển trang PDF
btnPrevPage.addEventListener('click', () => {
    if (currentFileType === 'pdf' && viewer.currentPageNumber > 1) jumpToPage(viewer.currentPageNumber - 1);
});

btnNextPage.addEventListener('click', () => {
    if (currentFileType === 'pdf' && pdfDoc && viewer.currentPageNumber < pdfDoc.numPages) jumpToPage(viewer.currentPageNumber + 1);
});

pageNumberInput.addEventListener('change', () => {
    const val = parseInt(pageNumberInput.value);
    if (currentFileType === 'pdf' && pdfDoc && val >= 1 && val <= pdfDoc.numPages) jumpToPage(val);
    else pageNumberInput.value = viewer.currentPageNumber;
});

async function jumpToPage(pageNum) {
    if (isPlaying) { player.stop(); setPlayState(false); }
    await viewer.renderPage(pageNum, handlePdfSpanClick);
    pageNumberInput.value = pageNum;
    buildPdfPageSentenceMap();
    const targetIdx = sentenceItems.findIndex(item => item.page === pageNum);
    if (targetIdx !== -1) {
        currentIndex = targetIdx;
        highlightSentence(sentenceItems[currentIndex].text, currentIndex);
    }
}

// Tải tệp mới
pdfFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    player.stop();
    player.clearCache();
    setPlayState(false);
    showLoading();

    btnRead.disabled = true;
    btnStop.disabled = true;
    pdfContainer.innerHTML = "";
    sentenceItems = [];
    currentIndex = 0;

    const isDocx = file.name.toLowerCase().endsWith('.docx');
    currentFileType = isDocx ? 'docx' : 'pdf';

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = isDocx ? "http://127.0.0.1:8000/api/extract-docx" : "http://127.0.0.1:8000/api/extract-pdf";

    try {
        const response = await fetch(endpoint, { method: "POST", body: formData });
        const data = await response.json();
        sentenceItems = data.items;

        const fileReader = new FileReader();

        if (isDocx) {
            paginationBar.style.display = 'none';
            fileReader.onload = async function() {
                await renderDocxToContainer(this.result, pdfContainer, sentenceItems, (selectedIdx) => {
                    startPlaybackFrom(selectedIdx);
                });
                onDocumentLoaded();
            };
            fileReader.readAsArrayBuffer(file);
        } else {
            paginationBar.style.display = 'flex';
            fileReader.onload = async function() {
                pdfDoc = await viewer.loadDocument(new Uint8Array(this.result));
                pageCountLabel.innerText = `/ ${pdfDoc.numPages}`;
                pageNumberInput.max = pdfDoc.numPages;
                pageNumberInput.value = 1;
                pageNumberInput.disabled = pdfDoc.numPages <= 1;
                btnPrevPage.disabled = pdfDoc.numPages <= 1;
                btnNextPage.disabled = pdfDoc.numPages <= 1;
                await viewer.renderPage(1, handlePdfSpanClick);
                buildPdfPageSentenceMap();
                onDocumentLoaded();
            };
            fileReader.readAsArrayBuffer(file);
        }
    } catch (err) {
        console.error(err);
        hideLoading();
    }
});

function onDocumentLoaded() {
    setPlayState(false);
    hideLoading();
    currentIndex = 0;
    if (sentenceItems.length > 0) highlightSentence(sentenceItems[0].text, 0);
}

function startPlaybackFrom(index) {
    currentIndex = index;
    isPlaying = true;
    setPlayState(true);
    player.stop();
    player.clearCache();
    playSentence(currentIndex);
}

// Xây dựng bản đồ tra cứu nhanh cho PDF ngay khi trang render xong
function buildPdfPageSentenceMap() {
    pdfSpanSentenceMap.clear();
    const spans = Array.from(document.querySelectorAll('#active-pdf-page .textLayer span'));
    if (!spans.length) return;

    const targetList = sentenceItems
        .map((item, idx) => ({ ...item, globalIndex: idx }))
        .filter(item => item.page === viewer.currentPageNumber);

    if (!targetList.length) return;

    spans.forEach((span, spanIdx) => {
        const spanText = span.textContent.trim();
        if (!spanText || spanText.length < 2) return;
        const normSpan = normalizeText(spanText);

        const found = targetList.find(item => normalizeText(item.text).includes(normSpan));
        if (found) {
            pdfSpanSentenceMap.set(spanIdx, found.globalIndex);
        }
    });
}

// Click trên PDF: Tra cứu siêu tốc O(1) qua Map đã xây sẵn
function handlePdfSpanClick(clickedSpanIdx) {
    if (pdfSpanSentenceMap.has(clickedSpanIdx)) {
        startPlaybackFrom(pdfSpanSentenceMap.get(clickedSpanIdx));
        return;
    }

    const targetList = sentenceItems
        .map((item, idx) => ({ ...item, globalIndex: idx }))
        .filter(item => item.page === viewer.currentPageNumber);

    if (targetList.length > 0) {
        startPlaybackFrom(targetList[0].globalIndex);
    }
}

// Nút Đọc / Dừng
btnRead.addEventListener('click', () => {
    if (!sentenceItems.length) return;
    if (currentFileType === 'pdf') {
        const first = sentenceItems.findIndex(i => i.page === viewer.currentPageNumber);
        if (first !== -1) currentIndex = first;
    }
    setPlayState(true);
    player.clearCache();
    playSentence(currentIndex);
});

btnStop.addEventListener('click', () => {
    player.stop();
    setPlayState(false);
});

async function playSentence(index) {
    if (!isPlaying || index >= sentenceItems.length) {
        setPlayState(false);
        if (index >= sentenceItems.length) currentIndex = 0;
        return;
    }

    currentIndex = index;
    const item = sentenceItems[index];

    if (currentFileType === 'pdf' && viewer.currentPageNumber !== item.page) {
        await viewer.renderPage(item.page, handlePdfSpanClick);
        buildPdfPageSentenceMap();
        pageNumberInput.value = item.page;
    }

    highlightSentence(item.text, index);
    for (let i = 1; i <= 2; i++) {
        if (index + i < sentenceItems.length) {
            player.prefetch(index + i, sentenceItems[index + i].text, currentVoice);
        }
    }

    player.play(
        index,
        item.text,
        currentVoice,
        currentSpeed,
        () => { 
            if (isPlaying) {
                playSentence(index + 1); 
            }
        },
        () => { 
            if (isPlaying) {
                playSentence(index + 1); 
            }
        },
        showLoading,
        hideLoading
    );
}