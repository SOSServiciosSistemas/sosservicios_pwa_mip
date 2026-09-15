const urlParams = new URLSearchParams(window.location.search);
const idOrden = urlParams.get('folio');

// Variables para la firma
let signaturePad;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Inicializar el lienzo de firma
    const canvas = document.getElementById('canvas-firma');
    signaturePad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)' });

    function redimensionarCanvas() {
        const ratio =  Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d").scale(ratio, ratio);
        signaturePad.clear();
    }
    window.onresize = redimensionarCanvas;
    redimensionarCanvas();

    // 2. Cargar los datos de la orden
    if (idOrden) {
        await cargarDatosReporte(idOrden);
    }
});

window.limpiarFirma = function() {
    signaturePad.clear();
};

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

// 3. Generar PDF y enviarlo al servidor
document.getElementById('btn-generar-pdf').addEventListener('click', async () => {
    if (signaturePad.isEmpty()) {
        alert("El cliente debe firmar el documento en el recuadro antes de guardar.");
        return;
    }

    const btnPdf = document.getElementById('btn-generar-pdf');
    btnPdf.innerText = "⏳ Generando y guardando...";
    btnPdf.disabled = true;

    // A. Pegar la firma en la hoja
    const imagenFirma = signaturePad.toDataURL("image/png");
    const imgElement = document.getElementById('img-firma-cliente');
    imgElement.src = imagenFirma;
    imgElement.style.display = 'block';

    // B. Ocultar el panel de firma para que no salga impreso
    document.getElementById('controles-tecnico').style.display = 'none';

    // C. Opciones de PDF
    const elementoHoja = document.getElementById('documento-reporte');
    const opciones = {
        margin:       1,
        filename:     `Reporte_${idOrden}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'cm', format: 'letter', orientation: 'portrait' }
    };

    try {
        // Transformar a Base64
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
            restaurarVistaBotones(btnPdf);
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión al generar el PDF.");
        restaurarVistaBotones(btnPdf);
    }
});

function restaurarVistaBotones(btnPdf) {
    document.getElementById('controles-tecnico').style.display = 'block';
    document.getElementById('img-firma-cliente').style.display = 'none';
    btnPdf.innerText = "✅ Finalizar y Guardar";
    btnPdf.disabled = false;
}

