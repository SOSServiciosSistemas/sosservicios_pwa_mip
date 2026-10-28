// Lógica para el formulario de Inspección y Diagnóstico de Presupuesto
let ordenActual = null;
let padInspector = null;
let padCliente = null;
let firmaClienteBase64 = null;
let contadorAreas = 0;

const CATALOGO_PLAGAS_INSPECCION = [
    { id: 'BG', label: 'BG', desc: 'C. Alemana' },
    { id: 'PA', label: 'PA', desc: 'C. Americana' },
    { id: 'T', label: 'T', desc: 'Tijerilla' },
    { id: 'A', label: 'A', desc: 'Araña' },
    { id: 'H', label: 'H', desc: 'Hormiga' },
    { id: 'G', label: 'G', desc: 'Grillo' },
    { id: 'C', label: 'C', desc: 'Cochinilla' },
    { id: 'AL', label: 'AL', desc: 'Alacrán' },
    { id: 'PJ', label: 'PJ', desc: 'Jardín' },
    { id: 'AB', label: 'AB', desc: 'Abejas' },
    { id: 'PG', label: 'PG', desc: 'Granos' },
    { id: 'O', label: 'O', desc: 'Otros' },
    { id: 'CC', label: 'CC', desc: 'Chinche' },
    { id: 'R', label: 'R', desc: 'Roedores' }
];

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const folio = urlParams.get('folio');

    if (!folio) {
        window.location.href = "tecnico.html";
        return;
    }

    // Configuración de navegación
    document.getElementById('badge-folio').innerText = `Folio: ${folio}`;
    document.getElementById('btn-volver').onclick = () => window.location.href = `orden.html?folio=${folio}`;

    // Cargar datos de la orden
    await cargarDatosOrden(folio);

    // Inicializar Canvas de Firma del Inspector
    inicializarPadInspector();

    // Inicializar Canvas de Firma del Cliente
    inicializarPadCliente();

    // Eventos
    document.getElementById('btn-agregar-area').onclick = () => agregarArea();

    // Manejo de Próxima Visita
    const selectProx = document.getElementById('select-proxima-visita');
    const boxFechaProx = document.getElementById('box-fecha-proxima');
    selectProx.addEventListener('change', () => {
        if (selectProx.value === 'Si') {
            boxFechaProx.style.display = 'block';
            document.getElementById('fecha-proxima').required = true;
        } else {
            boxFechaProx.style.display = 'none';
            document.getElementById('fecha-proxima').required = false;
        }
    });

    // Agregar primera área por defecto
    agregarArea('General / Entrada');

    // Manejo del envío del formulario
    document.getElementById('form-inspeccion').addEventListener('submit', guardarInspeccion);
});

// Cargar información de la orden
async function cargarDatosOrden(folio) {
    try {
        const res = await fetch(`${BASE_URL}/api/orden/${folio}`);
        const datos = await res.json();

        if (datos.exito && datos.orden) {
            ordenActual = datos.orden;

            document.getElementById('nav-titulo').innerHTML = `<i class="fas fa-search-location me-1"></i> Inspección #${ordenActual.id_orden}`;
            document.getElementById('info-cliente').innerText = (ordenActual.nombre_cliente || 'Sin cliente').toUpperCase();
            
            const direccion = `${ordenActual.domicilio || ''} ${ordenActual.colonia ? ', Col. ' + ordenActual.colonia : ''} ${ordenActual.ciudad ? ', ' + ordenActual.ciudad : ''}`;
            document.getElementById('info-direccion').innerText = direccion.trim() || 'Dirección no disponible';

            const tel = Array.isArray(ordenActual.telefono) ? ordenActual.telefono.join(' / ') : (ordenActual.telefono || 'Sin teléfono');
            const contacto = ordenActual.persona_contacto || ordenActual.contacto || ordenActual.nombre_cliente;
            document.getElementById('info-contacto-tel').innerText = `Contacto: ${contacto} | Tel: ${tel}`;

            const hoy = new Date();
            document.getElementById('badge-fecha').innerText = `Fecha: ${hoy.toLocaleDateString('es-MX')}`;

            // Nombre del técnico en la firma
            const nombreTecnico = localStorage.getItem('nombreUsuario') || 'Inspector Especialista';
            document.getElementById('nombre-inspector-txt').innerText = nombreTecnico;
        }
    } catch (error) {
        console.error("Error al cargar orden:", error);
    }
}

// Inicializar pad del inspector
function inicializarPadInspector() {
    const canvas = document.getElementById('canvas-firma-inspector');
    
    function redimensionar() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        if (padInspector) padInspector.clear();
    }

    padInspector = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        minWidth: 1.5,
        maxWidth: 3.5
    });

    redimensionar();
    window.addEventListener('resize', redimensionar);

    document.getElementById('btn-limpiar-firma-inspector').onclick = () => {
        padInspector.clear();
    };
}

// Inicializar pad del cliente en el modal
function inicializarPadCliente() {
    const canvas = document.getElementById('pizarra-firma-cliente');
    const modal = document.getElementById('modal-firma-cliente');
    const btnAbrir = document.getElementById('btn-abrir-modal-firma-cliente');
    const btnCerrar = document.getElementById('btn-cerrar-modal-firma');
    const btnBorrar = document.getElementById('btn-borrar-pizarra-cliente');
    const btnAceptar = document.getElementById('btn-aceptar-firma-cliente');

    function redimensionar() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        if (padCliente) padCliente.clear();
    }

    padCliente = new SignaturePad(canvas, {
        backgroundColor: 'rgb(255, 255, 255)',
        minWidth: 2,
        maxWidth: 5
    });

    btnAbrir.onclick = () => {
        modal.classList.remove('d-none');
        document.body.style.overflow = 'hidden';
        setTimeout(redimensionar, 100);
    };

    btnCerrar.onclick = () => {
        modal.classList.add('d-none');
        document.body.style.overflow = 'auto';
    };

    btnBorrar.onclick = () => {
        padCliente.clear();
    };

    btnAceptar.onclick = () => {
        if (padCliente.isEmpty()) {
            alert("Por favor solicite al cliente que plasme su firma antes de continuar.");
            return;
        }

        firmaClienteBase64 = recortarFirma(canvas);
        const imgPreview = document.getElementById('img-preview-firma-cliente');
        imgPreview.src = firmaClienteBase64;
        imgPreview.style.display = 'block';
        document.getElementById('txt-sin-firma-cliente').style.display = 'none';

        modal.classList.add('d-none');
        document.body.style.overflow = 'auto';
    };
}

// Agregar tarjeta de área
function agregarArea(nombreInicial = '') {
    contadorAreas++;
    const idArea = contadorAreas;
    const contenedor = document.getElementById('contenedor-areas');

    const card = document.createElement('div');
    card.className = 'tarjeta-area';
    card.id = `area-card-${idArea}`;

    let botonesPlagasHTML = '';
    CATALOGO_PLAGAS_INSPECCION.forEach(p => {
        botonesPlagasHTML += `
            <button type="button" class="btn btn-sm btn-outline-secondary boton-plaga btn-plaga-item" 
                data-plaga="${p.id}" title="${p.desc}">
                ${p.id}
            </button>
        `;
    });

    card.innerHTML = `
        <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="fw-bold text-dark small"><i class="fas fa-map-marker-alt text-primary me-1"></i> Área #${idArea}</span>
            <button type="button" class="btn btn-sm text-danger p-0 btn-eliminar-area" title="Eliminar área">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>

        <div class="mb-2">
            <input type="text" class="form-control form-control-sm campo-nombre-area" placeholder="Ej. Cocina, Bodega, Comedor, Jardín..." value="${nombreInicial}" required>
        </div>

        <div class="mb-2">
            <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small fw-bold text-muted" style="font-size: 0.7rem;">PLAGAS DETECTADAS:</span>
                <span class="small text-muted" style="font-size: 0.65rem;">(Toque para marcar)</span>
            </div>
            <div class="d-flex flex-wrap plagas-contenedor">
                ${botonesPlagasHTML}
            </div>
        </div>

        <div class="row g-2 align-items-center mb-2">
            <div class="col-6">
                <span class="small fw-bold text-muted d-block" style="font-size: 0.7rem;">GRADO DE INFESTACIÓN (GI):</span>
                <select class="form-select form-select-sm campo-gi">
                    <option value="0">0 - N/A</option>
                    <option value="1">1 - Leve</option>
                    <option value="2">2 - Moderado</option>
                    <option value="3">3 - Alto</option>
                </select>
            </div>
            <div class="col-6">
                <span class="small fw-bold text-muted d-block" style="font-size: 0.7rem;">OBSERVACIONES / ACCIONES:</span>
                <input type="text" class="form-control form-control-sm campo-obs-area" placeholder="Ej. Grietas, zoclos, humedad...">
            </div>
        </div>
    `;

    contenedor.appendChild(card);

    // Eventos para los botones de plagas (toggle)
    card.querySelectorAll('.btn-plaga-item').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('activo');
        });
    });

    // Evento eliminar área
    card.querySelector('.btn-eliminar-area').addEventListener('click', () => {
        if (document.querySelectorAll('.tarjeta-area').length <= 1) {
            alert('Debe registrar al menos un área inspeccionada.');
            return;
        }
        card.remove();
    });
}

// Guardar Inspección
async function guardarInspeccion(e) {
    e.preventDefault();

    // Validar áreas
    const tarjetas = document.querySelectorAll('.tarjeta-area');
    if (tarjetas.length === 0) {
        alert("Debe agregar al menos un área en la inspección.");
        return;
    }

    const areas = [];
    const setPlagasEncontradas = new Set();

    tarjetas.forEach(card => {
        const nombre = card.querySelector('.campo-nombre-area').value.trim();
        const gi = card.querySelector('.campo-gi').value;
        const obs = card.querySelector('.campo-obs-area').value.trim();

        const plagasMarcadas = [];
        card.querySelectorAll('.btn-plaga-item.activo').forEach(btn => {
            const pId = btn.getAttribute('data-plaga');
            plagasMarcadas.push(pId);
            setPlagasEncontradas.add(pId);
        });

        if (nombre) {
            areas.push({
                area: nombre,
                plagas: plagasMarcadas,
                grado_infestacion: gi,
                observaciones: obs
            });
        }
    });

    // Validar firma del inspector
    if (padInspector.isEmpty()) {
        alert("Por favor estampe su firma como Inspector antes de finalizar.");
        return;
    }
    const canvasInspector = document.getElementById('canvas-firma-inspector');
    const firmaInspectorBase64 = recortarFirma(canvasInspector);

    // Validar firma del cliente
    if (!firmaClienteBase64) {
        const confirmarSinFirma = confirm("Aún no ha capturado la firma del cliente para el formato de recomendaciones. ¿Desea guardarlo sin la firma del cliente?");
        if (!confirmarSinFirma) return;
    }

    // Datos del formulario
    const higieneRadio = document.querySelector('input[name="condicion_higiene"]:checked');
    const higiene = higieneRadio ? higieneRadio.value : 'B';

    const tratRadio = document.querySelector('input[name="tratamiento_propuesto"]:checked');
    const tratamiento = tratRadio ? tratRadio.value : 'P';

    const cuantasApps = document.getElementById('cuantas-aplicaciones').value || '1';
    const accionesCorrectivas = document.getElementById('acciones-correctivas').value.trim();
    const tiempoRequerido = document.getElementById('tiempo-requerido').value.trim();
    const tratamientoCosto = document.getElementById('tratamiento-costo').value.trim();
    const proxVisita = document.getElementById('select-proxima-visita').value;
    const fechaProx = proxVisita === 'Si' ? document.getElementById('fecha-proxima').value : '';
    const montoCobrado = parseFloat(document.getElementById('monto-cobrado').value) || 0;

    // Plagas en texto legible para el documento de seguimiento
    const nombresPlagasTexto = Array.from(setPlagasEncontradas).map(id => {
        const found = CATALOGO_PLAGAS_INSPECCION.find(c => c.id === id);
        return found ? found.desc : id;
    }).join(', ');

    const folio = new URLSearchParams(window.location.search).get('folio');
    const horaInicio = localStorage.getItem('hora_inicio_' + folio) || new Date().toISOString();
    const horaFin = new Date().toISOString();

    const detallesJSON = {
        tipo_documento: 'inspeccion',
        contacto: ordenActual ? (ordenActual.persona_contacto || ordenActual.contacto || ordenActual.nombre_cliente) : '',
        hora_entrada: horaInicio,
        hora_salida: horaFin,
        fecha_servicio: new Date().toISOString(),
        tabla_areas: areas,
        condiciones_higiene: higiene,
        tratamiento_propuesto: tratamiento,
        cuantas_aplicaciones: cuantasApps,
        acciones_correctivas: accionesCorrectivas,
        acciones_correctivas_requeridas: accionesCorrectivas,
        tiempo_requerido: tiempoRequerido,
        tratamiento_costo: tratamientoCosto,
        proxima_visita: proxVisita,
        fecha_proxima: fechaProx,
        firma_inspector: firmaInspectorBase64,
        firma_cliente: firmaClienteBase64,
        plagas_detectadas_texto: nombresPlagasTexto || 'Sin plaga aparente',
        tabla_productos: [] // Cero productos ya que es una inspección
    };

    const btnSubmit = document.getElementById('btn-guardar-inspeccion');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fas fa-spinner fa-spin me-1"></i> Guardando...`;

    try {
        const respuesta = await fetch(`${BASE_URL}/api/reportes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_orden: folio,
                letra: 'A',
                hora_inicio: horaInicio,
                hora_fin: horaFin,
                detalles: detallesJSON,
                id_tecnico: localStorage.getItem('idUsuario'),
                monto_cobrado: montoCobrado
            })
        });

        const datos = await respuesta.json();

        if (datos.exito) {
            localStorage.removeItem('hora_inicio_' + folio);

            // Configurar botones del modal de éxito
            document.getElementById('btn-ver-diagnostico').href = `../documentosclientes/inspeccion_diagnostico.html?folio=${folio}`;
            document.getElementById('btn-ver-seguimiento').href = `../documentosclientes/recomendaciones_seguimiento.html?folio=${folio}`;

            const modalExito = new bootstrap.Modal(document.getElementById('modalExito'));
            modalExito.show();
        } else {
            alert("Error al guardar inspección: " + (datos.error || 'Error desconocido'));
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = `<i class="fas fa-check-circle me-1"></i> Guardar y Finalizar Inspección`;
        }
    } catch (error) {
        console.error("Error de conexión:", error);
        alert("Error de conexión al guardar la inspección.");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fas fa-check-circle me-1"></i> Guardar y Finalizar Inspección`;
    }
}

// Recortar canvas para eliminar márgenes en blanco de la firma
function recortarFirma(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let hayTrazo = false;

    for (let y = 0; y < h; y += 2) {
        for (let x = 0; x < w; x += 2) {
            const index = (y * w + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];

            if (a > 30 && (r < 225 || g < 225 || b < 225)) {
                hayTrazo = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (!hayTrazo) {
        return canvas.toDataURL("image/png");
    }

    const padding = Math.max(15, Math.round(w * 0.02));
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cropWidth = maxX - minX;
    const cropHeight = maxY - minY;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropWidth;
    croppedCanvas.height = cropHeight;
    const croppedCtx = croppedCanvas.getContext('2d');

    croppedCtx.fillStyle = '#ffffff';
    croppedCtx.fillRect(0, 0, cropWidth, cropHeight);

    croppedCtx.drawImage(
        canvas,
        minX, minY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
    );

    return croppedCanvas.toDataURL("image/png");
}
