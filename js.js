pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');
const toolsContainer = document.getElementById('tools-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const pageIndicator = document.getElementById('page-indicator');
const readBtn = document.getElementById('read-btn');
const stopReadBtn = document.getElementById('stop-read-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');

let pageFlip = null;
let pdfDoc = null;
let currentScale = 1.5; // Escala inicial óptima
let pageTexts = [];    // Almacena el texto extraído de cada página para el lector de voz

// Efecto de sonido de pasar página generado por código (AudioContext)
function playPageFlipSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'triangle';
        // Simula el tono rápido de pasar la hoja
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.15);

        gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
        console.log("Audio no soportado o bloqueado por interacción del navegador", e);
    }
}

// Carga automática del PDF alojado en el repositorio
async function loadDefaultPDF() {
    try {
        const response = await fetch('cuento.pdf');
        if (!response.ok) throw new Error('No se pudo encontrar el archivo cuento.pdf en el repositorio.');
        const blob = await response.blob();
        const arrayBuffer = await blob.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);
        
        await processPDF(typedarray);
    } catch (error) {
        console.error('Error al cargar el PDF:', error);
        loading.innerText = '⚠️ Error: No se encontró el archivo "cuento.pdf" en el repositorio. Asegúrate de subirlo.';
    }
}

async function processPDF(pdfData) {
    loading.style.display = 'block';
    bookContainer.style.display = 'none';
    bookContainer.innerHTML = '';
    pageTexts = [];
    
    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    try {
        pdfDoc = await pdfjsLib.getDocument(pdfData).promise;
        const totalPages = pdfDoc.numPages;
        
        const firstPage = await pdfDoc.getPage(1);
        const viewportInfo = firstPage.getViewport({ scale: currentScale });
        const pageWidth = viewportInfo.width;
        const pageHeight = viewportInfo.height;

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            
            // Extraer texto para accesibilidad (lector de voz)
            const textContent = await page.getTextContent();
            const textStr = textContent.items.map(item => item.str).join(' ');
            pageTexts.push(textStr);

            const viewport = page.getViewport({ scale: currentScale });
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
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
            maxWidth: pageWidth,
            minHeight: 400,
            maxHeight: pageHeight,
            showCover: true,
            maxShadowOpacity: 0.6, // Sombra suave para efecto de libro real
            usePortrait: true
        });

        const pages = document.querySelectorAll('.page');
        pageFlip.loadFromHTML(pages);
        
        // Eventos de cambio de página para actualizar indicador y reproducir sonido mágico
        pageFlip.on('flip', (e) => {
            const currentPageNum = e.data + 1;
            pageIndicator.innerText = `Página ${currentPageNum} de ${totalPages}`;
            playPageFlipSound();
        });

        pageIndicator.innerText = `Página 1 de ${totalPages}`;
        loading.style.display = 'none';
        toolsContainer.style.display = 'flex';
        
    } catch (error) {
        console.error('Error al procesar el PDF:', error);
        loading.innerText = 'Error al procesar el cuento en PDF.';
    }
}

// Controles de navegación manual
prevBtn.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipPrev();
});

nextBtn.addEventListener('click', () => {
    if (pageFlip) pageFlip.flipNext();
});

// Botones de Zoom (Agrandar / Achicar texto e imágenes)
zoomInBtn.addEventListener('click', () => {
    if (currentScale < 2.2) {
        currentScale += 0.25;
        reloadPDFWithCurrentScale();
    }
});

zoomOutBtn.addEventListener('click', () => {
    if (currentScale > 1.0) {
        currentScale -= 0.25;
        reloadPDFWithCurrentScale();
    }
});

async function reloadPDFWithCurrentScale() {
    if (!pdfDoc) return;
    loading.style.display = 'block';
    loading.innerText = 'Ajustando tamaño del cuento...';
    const data = await pdfDoc.getData();
    await processPDF(data);
}

// Accesibilidad: Lector de voz en español para baja visión
readBtn.addEventListener('click', () => {
    if (!pageFlip) return;
    const currentIndex = pageFlip.getCurrentPageIndex();
    const textToRead = pageTexts[currentIndex] || "Página sin texto legible.";
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Detener cualquier lectura previa
        const utterance = new SpeechSynthesisUtterance(textToRead);
        utterance.lang = 'es-ES';
        utterance.rate = 0.9; // Velocidad ligeramente pausada para niños

        utterance.onstart = () => {
            readBtn.style.display = 'none';
            stopReadBtn.style.display = 'inline-block';
        };

        utterance.onend = () => {
            readBtn.style.display = 'inline-block';
            stopReadBtn.style.display = 'none';
        };

        window.speechSynthesis.speak(utterance);
    } else {
        alert("Lo siento, tu navegador no soporta la lectura en voz alta.");
    }
});

stopReadBtn.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        readBtn.style.display = 'inline-block';
        stopReadBtn.style.display = 'none';
    }
});

// Inicializar al cargar la página
loadDefaultPDF();