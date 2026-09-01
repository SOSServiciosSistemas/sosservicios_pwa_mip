document.addEventListener('DOMContentLoaded', async () => {
    // Extrae el ID de la bitácora desde la URL (Ejemplo: imprimir_planeador.html?id=15)
    const urlParams = new URLSearchParams(window.location.search);
    const idBitacora = urlParams.get('id');

    if (!idBitacora) {
        alert("Falta el folio de la bitácora.");
        return;
    }

    await cargarDatosImpresion(idBitacora);
});

// Obtiene los datos del servidor y dibuja el formato físico
async function cargarDatosImpresion(idBitacora) {
    try {
        const respuesta = await fetch(BASE_URL + `/api/bitacoras/resumen/${idBitacora}`);
        const datos = await respuesta.json();

        if (datos.exito) {
            const b = datos.bitacora;
            
            // 1. Dibuja el Encabezado (Ahora usa nombre_tecnico)
            document.getElementById('lbl-tecnico').innerText = b.nombre_tecnico; 
            const fecha = new Date(b.fecha_jornada);
            document.getElementById('lbl-fecha').innerText = fecha.toLocaleDateString('es-MX');

            // 2. Dibuja la Revisión de Unidad y Kilómetros
            document.getElementById('lbl-km-inicial').innerText = b.km_inicial;
            document.getElementById('lbl-km-final').innerText = b.km_final || 'N/A';
            
            const rev = b.revision_vehiculo || {};
            if (rev.bateria === 'B') document.getElementById('chk-bat-b').innerText = 'X'; else if (rev.bateria === 'M') document.getElementById('chk-bat-m').innerText = 'X';
            if (rev.aceite === 'B') document.getElementById('chk-ace-b').innerText = 'X'; else if (rev.aceite === 'M') document.getElementById('chk-ace-m').innerText = 'X';
            if (rev.fugas === 'B') document.getElementById('chk-fug-b').innerText = 'X'; else if (rev.fugas === 'M') document.getElementById('chk-fug-m').innerText = 'X';
            if (rev.fusibles === 'B') document.getElementById('chk-fus-b').innerText = 'X'; else if (rev.fusibles === 'M') document.getElementById('chk-fus-m').innerText = 'X';
            
            document.getElementById('lbl-observaciones').innerText = rev.observaciones || '';

            // 3. Dibuja la Tabla Central (Genera 15 filas fijas)
            const tbody = document.getElementById('tabla-cuerpo');
            let htmlFilas = '';
            let sCosto = 0, sIngreso = 0, sGasto = 0;
            let registros = [];
            
            datos.servicios.forEach(s => {
                sCosto += parseFloat(s.costo) || 0;
                sIngreso += parseFloat(s.ingresos_cobrados) || 0;
                registros.push({
                    orden: s.id_orden,
                    descripcion: `${s.nombre_cliente} (${s.tipo_servicio})`,
                    costo: parseFloat(s.costo) || 0,
                    ingreso: parseFloat(s.ingresos_cobrados) || 0,
                    gasto: 0
                });
            });

            const extras = b.actividades_extra || [];
            extras.forEach(e => {
                sCosto += parseFloat(e.costo) || 0;
                sIngreso += parseFloat(e.ingreso) || 0;
                sGasto += parseFloat(e.gasto) || 0;
                registros.push({
                    orden: 'N/A',
                    descripcion: e.descripcion,
                    costo: parseFloat(e.costo) || 0,
                    ingreso: parseFloat(e.ingreso) || 0,
                    gasto: parseFloat(e.gasto) || 0
                });
            });

            for (let i = 0; i < 15; i++) {
                if (i < registros.length) {
                    const r = registros[i];
                    htmlFilas += `
                        <tr class="fila-alta">
                            <td class="celda-centrada">${r.orden}</td>
                            <td>${r.descripcion}</td>
                            <td class="celda-monto">${r.costo > 0 ? '$'+r.costo.toFixed(2) : '$-'}</td>
                            <td class="celda-monto">${r.ingreso > 0 ? '$'+r.ingreso.toFixed(2) : '$-'}</td>
                            <td class="celda-monto">${r.gasto > 0 ? '$'+r.gasto.toFixed(2) : '$-'}</td>
                        </tr>`;
                } else {
                    htmlFilas += `<tr class="fila-alta"><td></td><td></td><td></td><td></td><td></td></tr>`;
                }
            }
            tbody.innerHTML = htmlFilas;

            // 4. Imprime Totales
            document.getElementById('lbl-tot-costo').innerText = `$${sCosto.toFixed(2)}`;
            document.getElementById('lbl-tot-ingreso').innerText = `$${sIngreso.toFixed(2)}`;
            document.getElementById('lbl-tot-gasto').innerText = `$${sGasto.toFixed(2)}`;
            document.getElementById('lbl-total-recibido').innerText = `$${b.total_efectivo_entregado || (sIngreso - sGasto).toFixed(2)}`;

            // 5. Inyecta la consolidación de Químicos
            const tbodyProductos = document.getElementById('tabla-productos');
            let htmlProductos = '';
            let productosEncontrados = false;

            datos.servicios.forEach(s => {
                if (s.detalles_ejecucion) {
                    // Parsea el JSON del reporte MIP guardado por el técnico
                    let detalles = typeof s.detalles_ejecucion === 'string' ? JSON.parse(s.detalles_ejecucion) : s.detalles_ejecucion;
                    
                    // Extrae el arreglo de químicos (Asegúrate de que coincida con la llave que usas en el reporte, ej. 'quimicos' o 'productos')
                    let listaQuimicos = detalles.quimicos || detalles.productos || []; 
                    
                    listaQuimicos.forEach(q => {
                        productosEncontrados = true;
                        htmlProductos += `
                            <tr>
                                <td class="fw-bold">${q.producto || q.nombre || '-'}</td>
                                <td>${q.en_unidad || '-'}</td>
                                <td>${q.usado || '-'}</td>
                                <td>${q.preparados || '-'}</td>
                                <td>${q.aplicado || '-'}</td>
                                <td>${q.observaciones || ''}</td>
                            </tr>
                        `;
                    });
                }
            });

            // Agrega filas vacías si no hubo productos para mantener el formato visual de la hoja
            if (!productosEncontrados) {
                for(let i=0; i<3; i++) {
                    htmlProductos += `<tr><td style="height: 18px;"></td><td></td><td></td><td></td><td></td><td></td></tr>`;
                }
            }
            tbodyProductos.innerHTML = htmlProductos;

            // 6. Inyecta las Firmas de Cierre
            const firmas = b.firmas_cierre || {};
            if (firmas.tecnico) document.getElementById('img-firma-tecnico').src = firmas.tecnico;
            if (firmas.responsable) document.getElementById('img-firma-mesa1').src = firmas.responsable;

        } else {
            alert("Error al cargar la bitácora.");
        }
    } catch (error) {
        console.error("Error conectando al servidor:", error);
    }
}