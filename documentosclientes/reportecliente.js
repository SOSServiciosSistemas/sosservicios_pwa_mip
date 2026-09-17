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
            
            document.getElementById('rep-folio').innerText = orden.id_orden.toString().padStart(5, '0');
            document.getElementById('rep-fecha').innerText = new Date(orden.fecha_servicio).toLocaleDateString('es-MX');
            document.getElementById('rep-cliente').innerText = orden.nombre_cliente;
            document.getElementById('rep-domicilio').innerText = orden.direccion_completa;
            document.getElementById('rep-telefonos').innerText = orden.telefono;
            document.getElementById('rep-giro').innerText = orden.giro_comercial || 'N/A';
            document.getElementById('rep-ciudad').innerText = orden.ciudad || 'León, Gto.';
            document.getElementById('rep-hora-ent').innerText = orden.hora_llegada || '--:--';
            document.getElementById('rep-hora-sal').innerText = orden.hora_salida || '--:--';
            document.getElementById('rep-contacto').innerText = orden.persona_contacto || orden.nombre_cliente;
            
            const tbodyProductos = document.getElementById('rep-tabla-productos');
            tbodyProductos.innerHTML = '';
            
            if (datos.productos_utilizados && datos.productos_utilizados.length > 0) {
                const letras = ['A', 'B', 'C', 'D'];
                datos.productos_utilizados.forEach((prod, index) => {
                    const letra = letras[index] || '-';
                    tbodyProductos.innerHTML += `
                        <tr>
                            <td class="fw-bold">${letra}</td>
                            <td>${prod.ingrediente_activo || prod.nombre_comercial}</td>
                            <td>${prod.registro_sanitario || 'N/A'}</td>
                            <td>${prod.cantidad_usada} ${prod.unidad_medida}</td>
                        </tr>
                    `;
                });
            } else {
                tbodyProductos.innerHTML = '<tr><td colspan="4">No se registraron productos químicos.</td></tr>';
            }

            document.getElementById('rep-acciones').innerText = orden.acciones_realizadas || 'Sin observaciones detalladas.';
            document.getElementById('rep-seguimiento').innerText = orden.recomendaciones_seguimiento || 'Ninguno.';
            document.getElementById('rep-nombre-tecnico').innerText = orden.nombre_tecnico;
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