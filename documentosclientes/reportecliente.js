const urlParams = new URLSearchParams(window.location.search);
const idOrden = urlParams.get('folio');

// Variable global para la firma
let signaturePad;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar el lienzo de firma (ahora apuntando al canvas del modal)
    const canvas = document.getElementById('pizarra-firma');
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });

    // Función para ajustar el tamaño del canvas (vital para móviles)
    function redimensionarCanvas() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        signaturePad.clear();
    }

    // 2. Controladores del Modal de Firma
    const modalFirma = document.getElementById('modal-firma');
    const btnAbrirFirma = document.getElementById('btn-abrir-firma');
    const btnCerrarFirma = document.getElementById('btn-cerrar-firma');
    const btnBorrarFirma = document.getElementById('btn-borrar-firma');
    const btnGuardarFirma = document.getElementById('btn-guardar-firma');

    // Abrir el panel
    btnAbrirFirma.addEventListener('click', () => {
        modalFirma.classList.remove('d-none');
        document.body.style.overflow = 'hidden'; // Congela el fondo de la pantalla
        setTimeout(redimensionarCanvas, 100); // Redimensiona cuando ya es visible
    });

    // Cerrar el panel
    btnCerrarFirma.addEventListener('click', () => {
        modalFirma.classList.add('d-none');
        document.body.style.overflow = 'auto'; // Descongela el fondo
    });

    // Limpiar firma
    btnBorrarFirma.addEventListener('click', () => {
        signaturePad.clear();
    });

    // Reajustar si giran el celular
    window.addEventListener("resize", () => {
        if (!modalFirma.classList.contains('d-none')) {
            redimensionarCanvas();
        }
    });

    // Asignar el evento para generar PDF al botón de guardar del modal
    btnGuardarFirma.addEventListener('click', generarPDF);

    // 3. Cargar los datos de la orden de la Base de Datos
    if (idOrden) {
        await cargarDatosReporte(idOrden);
    }
});

// Función para obtener los datos del servidor
async function cargarDatosReporte(id) {
    try {
        const respuesta = await fetch(BASE_URL + `/api/ordenes/${id}/reporte-final`);
        const datos = await respuesta.json();

        if (datos.exito) {
            const orden = datos.orden;
            
            // Función auxiliar para horas (Ajuste UTC-6 para zona horaria de México)
            const formatHora = (fecha) => {
                if (!fecha) return '';
                let d = new Date(fecha);
                d.setHours(d.getHours() - 6);
                return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            };
            
            document.getElementById('rep-folio').innerText = orden.id_orden.toString().padStart(5, '0');
            document.getElementById('rep-fecha').innerText = new Date(orden.fecha_servicio).toLocaleDateString('es-MX');
            document.getElementById('rep-cliente').innerText = orden.nombre_cliente;
            document.getElementById('rep-domicilio').innerText = orden.direccion_completa;
            document.getElementById('rep-telefonos').innerText = orden.telefono;
            document.getElementById('rep-giro').innerText = orden.giro_comercial || '';
            document.getElementById('rep-ciudad').innerText = orden.ciudad || '';
            document.getElementById('rep-contacto').innerText = orden.persona_contacto || orden.nombre_cliente;
            document.getElementById('rep-hora-ent').innerText = formatHora(orden.hora_llegada);
            document.getElementById('rep-hora-sal').innerText = formatHora(orden.hora_salida);
            document.getElementById('rep-nombre-tecnico').innerText = orden.nombre_tecnico;

            // Lógica para Hora de Reingreso (+2 horas sobre la hora real de México)
            let textoReingreso = "";
            if (orden.hora_salida) {
                let fechaSalida = new Date(orden.hora_salida);
                fechaSalida.setHours(fechaSalida.getHours() - 6 + 2); 
                textoReingreso = fechaSalida.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
            }
            document.getElementById('rep-hora-reingreso').innerText = textoReingreso;

            // Llenado de Productos (Asegurando 4 filas fijas A,B,C,D para mantener formato)
            const tbodyProductos = document.getElementById('rep-tabla-productos');
            tbodyProductos.innerHTML = '';
            const letras = ['A', 'B', 'C', 'D'];
            
            for (let i = 0; i < 4; i++) {
                let prod = (datos.productos_utilizados && datos.productos_utilizados[i]) ? datos.productos_utilizados[i] : null;
                tbodyProductos.innerHTML += `
                    <tr>
                        <td class="fw-bold text-center">${letras[i]}</td>
                        <td>${prod ? (prod.ingrediente_activo || prod.nombre_comercial) : ''}</td>
                        <td>${prod ? (prod.registro_sanitario || 'N/A') : ''}</td>
                        <td class="text-center">${prod ? (prod.cantidad_usada + ' ' + prod.unidad_medida) : ''}</td>
                    </tr>
                `;
            }

            // ==========================================================
            // LLENADO DINÁMICO DE ÁREAS TRATADAS Y DETALLES JSON
            // ==========================================================
            const jsonDetalles = orden.detalles_completos || {};
            const tablaAreas = jsonDetalles.tabla_areas || jsonDetalles.areas || [];
            const tbodyAreas = document.getElementById('rep-tabla-areas');
            tbodyAreas.innerHTML = '';
            
            for (let i = 0; i < 10; i++) {
                if (tablaAreas[i]) {
                    const area = tablaAreas[i];
                    const actSi = (area.actividad === 'SI' || area.actividad === true) ? 'X' : '';
                    const actNo = (area.actividad === 'NO' || area.actividad === false) ? 'X' : '';
                    const plagasStr = Array.isArray(area.plagas) ? area.plagas.join(', ') : (area.plagas || '');
                    
                    tbodyAreas.innerHTML += `
                        <tr>
                            <td style="height: 16px;" class="fw-bold">${area.nombre || area.area || ''}</td>
                            <td class="text-center fw-bold">${actSi}</td>
                            <td class="text-center"></td>
                            <td class="text-center fw-bold">${actNo}</td>
                            <td class="text-center fw-bold">${plagasStr}</td>
                            <td class="text-center fw-bold">${area.productos_num || area.producto || ''}</td>                            <td class="text-center fw-bold">${area.metodo || area.metodo_aplicacion || ''}</td>
                            <td class="text-center">${area.observaciones || ''}</td>
                        </tr>
                    `;
                } else {
                    // Generar filas en blanco para que el PDF no pierda su tamaño
                    tbodyAreas.innerHTML += `
                        <tr>
                            <td style="height: 16px;"></td>
                            <td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                        </tr>
                    `;
                }
            }

            // ==========================================================
            // LLENADO DE CHECKBOXES, COSTOS Y TRATAMIENTOS
            // ==========================================================
            // 1. Grado de infestación
            const grado = (jsonDetalles.grado_infestacion || '').toUpperCase();
            if(grado === 'ALTO') document.getElementById('chk-alto').innerText = 'X';
            if(grado === 'MODERADO') document.getElementById('chk-moderado').innerText = 'X';
            if(grado === 'BAJO') document.getElementById('chk-bajo').innerText = 'X';

            // 2. Factura
            if (orden.requiere_factura === true) {
                document.getElementById('chk-factura-si').innerText = 'X';
            } else if (orden.requiere_factura === false) {
                document.getElementById('chk-factura-no').innerText = 'X';
            }

            // 3. Tratamientos y Costos
            document.getElementById('rep-tratamiento-actual').innerText = orden.num_tratamiento || '';
            document.getElementById('rep-tratamiento-total').innerText = orden.total_tratamientos || '';
            
            let costoMostrar = orden.costo_con_iva || orden.costo_sin_iva || '';
            if (costoMostrar) costoMostrar = parseFloat(costoMostrar).toFixed(2);
            document.getElementById('rep-costo').innerText = costoMostrar;
            document.getElementById('rep-costo-letra').innerText = '';

            // 4. Acciones y Seguimiento
            document.getElementById('rep-acciones').innerText = orden.acciones_realizadas || jsonDetalles.acciones_correctivas || '';
            document.getElementById('rep-seguimiento').innerText = orden.recomendaciones_seguimiento || jsonDetalles.indicaciones_proximas || '';
        }
    } catch (error) {
        console.error("Error al cargar el reporte del cliente:", error);
    }
}

// 4. Función para guardar firma, generar PDF y enviar al Backend
async function generarPDF() {
    if (signaturePad.isEmpty()) {
        alert("El cliente debe firmar el documento antes de guardar.");
        return;
    }

    // A. Ocultar el modal de firma y restaurar el scroll
    const modalFirma = document.getElementById('modal-firma');
    modalFirma.classList.add('d-none');
    document.body.style.overflow = 'auto';

    // B. Cambiar el botón inferior a estado de carga y ocultar su contenedor para no imprimirlo
    const btnAbrirFirma = document.getElementById('btn-abrir-firma');
    const zonaBotonFirmar = document.getElementById('zona-boton-firmar');
    btnAbrirFirma.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> Generando y guardando...`;
    btnAbrirFirma.disabled = true;
    zonaBotonFirmar.style.display = 'none';

    // C. Pegar la firma en la hoja
    const imagenFirma = signaturePad.toDataURL("image/png");
    const imgElement = document.getElementById('img-firma-cliente');
    const lineaFirma = document.getElementById('linea-firma-cliente');
    
    imgElement.src = imagenFirma;
    imgElement.style.display = 'block'; // Mostramos la firma
    lineaFirma.style.display = 'none';  // Ocultamos la rayita para que no estorbe

    // D. Opciones de PDF
    const elementoHoja = document.getElementById('documento-reporte');
    window.scrollTo(0, 0);
    const opciones = {
        margin:       1,
        filename:     `Reporte_${idOrden}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'cm', format: 'letter', orientation: 'portrait' }
    };

    try {
        // Transformar a Base64 puro
        const pdfBase64 = await html2pdf().set(opciones).from(elementoHoja).output('datauristring');
        
        // Enviar al Backend
        const respuesta = await fetch(BASE_URL + '/api/reportes/guardar-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folio: idOrden, pdfBase64: pdfBase64 })
        });

        const datos = await respuesta.json();

        if (datos.exito) {
            alert("¡Documento guardado con éxito en el servidor de la oficina!");
            window.location.href = "../viewtecnico/tecnico.html"; // Regresa al menú principal del técnico
        } else {
            alert("Error del servidor: " + datos.error);
            restaurarVistaBotones();
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión al generar el PDF.");
        restaurarVistaBotones();
    }
}

// Restaura la vista si algo falla al guardar
function restaurarVistaBotones() {
    const zonaBotonFirmar = document.getElementById('zona-boton-firmar');
    const btnAbrirFirma = document.getElementById('btn-abrir-firma');
    const imgElement = document.getElementById('img-firma-cliente');
    const lineaFirma = document.getElementById('linea-firma-cliente');

    zonaBotonFirmar.style.display = 'block'; // Volvemos a mostrar la zona del botón
    btnAbrirFirma.innerHTML = `<i class="fas fa-pen me-2"></i> Firmar Orden`;
    btnAbrirFirma.disabled = false;
    
    imgElement.style.display = 'none'; // Ocultamos la firma si falló
    lineaFirma.style.display = 'inline-block'; // Mostramos la rayita de nuevo
}