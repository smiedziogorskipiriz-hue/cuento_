pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const pageIndicator = document.getElementById('page-indicator');
const wand = document.getElementById('magic-wand');

// Botones de control
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnRead = document.getElementById('btn-read');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');

let pageFlip = null;
let currentScale = 1.5; // Escala inicial para nitidez y tamaño de renderizado
let pdfDocument = null;
let isReading = false;
let currentUtterance = null;

// Carga directa del cuento alojado en el repositorio raíz
window.addEventListener('DOMContentLoaded', () => {
    loadPDFFromRepo('cuento.pdf');
});

async function loadPDFFromRepo(pdfPath) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';
    bookContainer.innerHTML = '';

    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    try {
        pdfDocument = await pdfjsLib.getDocument(pdfPath).promise;
        await renderBookPages();
    } catch (error) {
        console.error('Error al cargar cuento.pdf:', error);
        loading.innerText = 'No se encontró el archivo "cuento.pdf" en el repositorio o hubo un error al procesarlo.';
    }
}

async function renderBookPages() {
    bookContainer.innerHTML = '';
    const totalPages = pdfDocument.numPages;
    const firstPage = await pdfDocument.getPage(1);
    const viewportInfo = firstPage.getViewport({ scale: currentScale });
    const pageWidth = viewportInfo.width;
    const pageHeight = viewportInfo.height;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDocument.getPage(pageNum);
        const viewport = page.getViewport({ scale: currentScale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        const pageDiv = document.createElement('div');
        pageDiv.className = 'page';
        pageDiv.appendChild(canvas);

        bookContainer.appendChild(pageDiv);
    }

    bookContainer.style.display = 'block';

    pageFlip = new St.PageFlip(bookContainer, {
        width: pageWidth,
        height: pageHeight,
        size: "stretch",
        minWidth: 300,
        maxWidth: pageWidth * 1.2,
        minHeight: 400,
        maxHeight: pageHeight * 1.2,
        showCover: true,
        maxShadowOpacity: 0.5,
        usePortrait: true
    });

    const pages = document.querySelectorAll('.page');
    pageFlip.loadFromHTML(pages);

    updatePageIndicator();

    // Eventos al cambiar de página
    pageFlip.on('flip', (e) => {
        updatePageIndicator();
        if (isReading) {
            stopSpeech();
            readCurrentPageText();
        }
    });

    loading.style.display = 'none';
}

function updatePageIndicator() {
    if (!pageFlip) return;
    const current = pageFlip.getCurrentPageIndex() + 1;
    const total = pdfDocument.numPages;
    pageIndicator.innerText = `Página ${current} de ${total}`;
}

// Visualización y efecto de la Varita Mágica
function triggerMagicWand(direction, callback) {
    wand.classList.remove('hidden', 'animating-next', 'animating-prev');
    
    // Forzar un reflow para reiniciar la animación CSS
    void wand.offsetWidth;

    wand.classList.add(direction === 'next' ? 'animating-next' : 'animating-prev');

    setTimeout(() => {
        if (callback) callback();
    }, 350); // Ejecuta el pase de página a la mitad del movimiento mágico

    setTimeout(() => {
        wand.classList.add('hidden');
        wand.classList.remove('animating-next', 'animating-prev');
    }, 700);
}

// Control de Navegación con Botones
btnNext.addEventListener('click', () => {
    if (pageFlip) {
        triggerMagicWand('next', () => {
            pageFlip.flipNext();
        });
    }
});

btnPrev.addEventListener('click', () => {
    if (pageFlip) {
        triggerMagicWand('prev', () => {
            pageFlip.flipPrev();
        });
    }
});

// Funcionalidad de Agrandar / Achicar Letra y Vista
btnZoomIn.addEventListener('click', () => {
    if (currentScale < 2.5) {
        currentScale += 0.25;
        renderBookPages();
    }
});

btnZoomOut.addEventListener('click', () => {
    if (currentScale > 1.0) {
        currentScale -= 0.25;
        renderBookPages();
    }
});

// Funcionalidad de Lectura en Voz Alta (Accesibilidad para baja visión)
btnRead.addEventListener('click', () => {
    if (!('speechSynthesis' in window)) {
        alert('Tu navegador no soporta la lectura de texto en voz alta.');
        return;
    }

    if (isReading) {
        stopSpeech();
    } else {
        readCurrentPageText();
    }
});

async function readCurrentPageText() {
    if (!pdfDocument || !pageFlip) return;

    const currentPageNum = pageFlip.getCurrentPageIndex() + 1;
    const page = await pdfDocument.getPage(currentPageNum);
    const textContent = await page.getTextContent();
    
    const textString = textContent.items.map(item => item.str).join(' ');

    if (!textString.trim()) {
        speakText("Esta página no contiene texto para leer.");
        return;
    }

    speakText(textString);
}

function speakText(text) {
    window.speechSynthesis.cancel();

    currentUtterance = new SpeechSynthesisUtterance(text);
    currentUtterance.lang = 'es-ES'; // Configurado en español
    currentUtterance.rate = 0.9; // Velocidad ligeramente pausada para niños

    // Selección de voz en español si está disponible
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
    if (spanishVoice) {
        currentUtterance.voice = spanishVoice;
    }

    currentUtterance.onstart = () => {
        isReading = true;
        btnRead.innerText = '⏸️ Detener Lectura';
        btnRead.style.backgroundColor = '#ff7675';
    };

    currentUtterance.onend = () => {
        stopSpeech();
    };

    currentUtterance.onerror = () => {
        stopSpeech();
    };

    window.speechSynthesis.speak(currentUtterance);
}

function stopSpeech() {
    window.speechSynthesis.cancel();
    isReading = false;
    btnRead.innerText = '🔊 Leer en Voz Alta';
    btnRead.style.backgroundColor = '#00cec9';
}

// Cargar voces del sistema previamente si están diferidas
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}