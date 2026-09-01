let idBitacoraDiaria = null;
let kmInicialDia = 0;
let totalEfectivoCalculado = 0;

document.addEventListener('DOMContentLoaded', async () => {
    // Verifica la sesión activa del usuario
    const idUsuario = localStorage.getItem('idUsuario');
    const nombreUsuario = localStorage.getItem('nombreUsuario');

    if (!idUsuario) {
        window.location.href = "../index.html";
        return;
    }

    // Personaliza el encabezado con el nombre del técnico
    document.getElementById('nombre-tecnico-nav').innerText = `Técnico: ${nombreUsuario}`;
    
    const fechaHoy = new Date();
    const opcionesFecha = { weekday: 'long', day: 'numeric', month: 'long' };
    let textoFecha = fechaHoy.toLocaleDateString('es-MX', opcionesFecha);
    textoFecha = textoFecha.charAt(0).toUpperCase() + textoFecha.slice(1);
    
    const tituloAgenda = document.getElementById('titulo-agenda');
    if (tituloAgenda) tituloAgenda.innerText = `Agenda: ${textoFecha}`;

    // Inicializa los dos lienzos de dibujo para las firmas
    iniciarCanvas('canvas-firma-tecnico');
    iniciarCanvas('canvas-firma-mesa');

    // Verifica el estado de la bitácora del día actual
    await verificarBitacora(idUsuario);
});

// ================= LÓGICA PRINCIPAL DE NAVEGACIÓN Y APERTURA =================
async function verificarBitacora(idUsuario) {
    try {
        const respuesta = await fetch(BASE_URL + `/api/bitacoras/hoy/${idUsuario}`);
        const datos = await respuesta.json();

        if (datos.exito && datos.bitacora) {
            idBitacoraDiaria = datos.bitacora.id_bitacora;
            
            // Asegura la conversión a número para validaciones posteriores
            kmInicialDia = parseFloat(datos.bitacora.km_inicial);

            if (datos.bitacora.estatus === 'En_Ruta') {
                // Muestra la agenda y la barra inferior si la ruta está activa
                document.getElementById('barra-bitacora').style.display = 'flex';
                cargarAgendaTecnico(idUsuario);
            } else if (datos.bitacora.estatus === 'Cerrada_Ruta') {
                // Oculta la barra y despliega directamente el Planeador
                document.getElementById('barra-bitacora').style.display = 'none';
                cargarPlaneador(true);
            } else if (datos.bitacora.estatus === 'Entregada') {
                // Oculta la barra y muestra el mensaje de éxito
                document.getElementById('barra-bitacora').style.display = 'none';
                document.getElementById('contenedor-agenda').innerHTML = `
                    <div class="alert alert-success text-center py-5 shadow-sm border-0 mt-4 rounded-4">
                        <h1 class="display-1">✅</h1>
                        <h3 class="fw-bold mt-3">Día Liquidado</h3>
                        <p class="text-muted">Has entregado tu planeador y efectivo a Mesa de Control exitosamente.</p>
                    </div>`;
            }
        } else {
            // Activa el candado estático si no existe una bitácora registrada
            document.getElementById('contenedor-agenda').innerHTML = ''; 
            new bootstrap.Modal(document.getElementById('modalAperturaJornada')).show();
        }
    } catch (error) {
        console.error("Error al verificar bitácora:", error);
        document.getElementById('contenedor-agenda').innerHTML = `<div class="alert alert-danger">Error de conexión al verificar jornada.</div>`;
    }
}

document.getElementById('form-apertura-jornada').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnIniciar = document.getElementById('btn-iniciar-jornada');
    btnIniciar.innerText = "Iniciando..."; btnIniciar.disabled = true;

    const revisionVehiculo = {
        bateria: document.getElementById('aj-bateria').value,
        aceite: document.getElementById('aj-aceite').value,
        fugas: document.getElementById('aj-fugas').value,
        fusibles: document.getElementById('aj-fusibles').value,
        observaciones: document.getElementById('aj-observaciones').value
    };

    const datosApertura = {
        id_tecnico: localStorage.getItem('idUsuario'),
        km_inicial: document.getElementById('aj-km-inicial').value,
        revision_vehiculo: revisionVehiculo
    };

    try {
        const respuesta = await fetch(BASE_URL + '/api/bitacoras/abrir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosApertura)
        });
        const datos = await respuesta.json();
        
        if (datos.exito) {
            idBitacoraDiaria = datos.id_bitacora;
            
            // Actualiza la variable en memoria al instante para el candado del kilometraje
            kmInicialDia = parseFloat(document.getElementById('aj-km-inicial').value);
            
            const modalElement = document.getElementById('modalAperturaJornada');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            
            // Dibuja la agenda y muestra la barra inferior tras completar el registro
            document.getElementById('barra-bitacora').style.display = 'flex';
            cargarAgendaTecnico(localStorage.getItem('idUsuario'));
        } else {
            alert(datos.error || "No se pudo iniciar la jornada");
        }
    } catch (error) {
        alert("Error de conexión al iniciar el día.");
    } finally {
        btnIniciar.innerText = "🚀 Arrancar Día"; btnIniciar.disabled = false;
    }
});

// ================= LÓGICA PARA DIBUJAR LA AGENDA =================
async function cargarAgendaTecnico(idUsuario) {
    const contenedorAgenda = document.getElementById('contenedor-agenda');
    contenedorAgenda.innerHTML = `<div class="alert alert-info">Cargando servicios de hoy...</div>`;

    try {
        const respuesta = await fetch(BASE_URL + `/api/agenda/${idUsuario}`);
        const datos = await respuesta.json();

        if (datos.exito && datos.agenda.length > 0) {
            contenedorAgenda.innerHTML = ''; 
            
            datos.agenda.forEach(orden => {
                const hora = new Date(orden.fecha_programada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                const colorBorde = orden.estatus === 'Pendiente' ? 'border-secondary' : 'border-primary';
                const colorBoton = orden.estatus === 'Pendiente' ? 'btn-secondary' : 'btn-primary';
                const textoBoton = orden.estatus === 'Pendiente' ? '🔒 Pendiente de Confirmar' : 'Ver Orden';

                const tarjetaHTML = `
                    <div class="card mb-3 shadow-sm border-start ${colorBorde} border-4">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h5 class="card-title mb-0 fw-bold">${hora}</h5>
                                <span class="badge bg-warning text-dark">Folio: ${orden.id_orden}</span>
                            </div>
                            <h6 class="card-subtitle mb-2 text-primary fw-bold">${orden.nombre_cliente}</h6>
                            <p class="card-text text-muted small mb-1">
                                <strong>Colonia:</strong> ${orden.colonia}<br>
                                <strong>Servicio:</strong> ${orden.tipo_servicio}<br>
                                <strong>Notas:</strong> ${orden.observaciones_mesa}
                            </p>
                            <button onclick="abrirOrden(${orden.id_orden}, '${orden.estatus}')" class="btn ${colorBoton} btn-sm w-100 mt-2 fw-bold">${textoBoton}</button>
                        </div>
                    </div>
                `;
                contenedorAgenda.innerHTML += tarjetaHTML;
            });
        } else {
            contenedorAgenda.innerHTML = `<div class="alert alert-success">Por ahora no tienes servicios pendientes para hoy.<br> Contacta con mesa de control </div>`;
        }
    } catch (error) {
        contenedorAgenda.innerHTML = `<div class="alert alert-danger">Error al cargar la agenda.</div>`;
    }
}

// ================= LÓGICA DE ACTIVIDADES EXTRA =================
// Prepara y muestra el formulario de actividades no planeadas
window.abrirModalActividad = function() {
    document.getElementById('form-actividad-extra').reset();
    
    // Autocompleta el campo con la hora actual del sistema
    const ahora = new Date();
    const horaLocal = ahora.getHours().toString().padStart(2, '0') + ':' + ahora.getMinutes().toString().padStart(2, '0');
    document.getElementById('ae-hora').value = horaLocal;
    
    new bootstrap.Modal(document.getElementById('modalActividadExtra')).show();
};

document.getElementById('form-actividad-extra').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnGuardar = e.target.querySelector('button[type="submit"]');
    btnGuardar.innerText = "Guardando..."; btnGuardar.disabled = true;

    // Convierte los campos de valores numéricos vacíos a 0 automáticamente
    const costoInput = parseFloat(document.getElementById('ae-costo').value) || 0;
    const ingresoInput = parseFloat(document.getElementById('ae-ingreso').value) || 0;
    const gastoInput = parseFloat(document.getElementById('ae-gasto').value) || 0;

    const datosActividad = {
        id_bitacora: idBitacoraDiaria,
        hora: document.getElementById('ae-hora').value,
        descripcion: document.getElementById('ae-descripcion').value,
        costo: costoInput,
        ingreso: ingresoInput,
        gasto: gastoInput
    };

    try {
        const respuesta = await fetch(BASE_URL + '/api/bitacoras/actividad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosActividad)
        });
        const datos = await respuesta.json();
        
        if (datos.exito) {
            bootstrap.Modal.getInstance(document.getElementById('modalActividadExtra')).hide();
            alert("✅ Registro guardado con éxito.");
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        alert("Error de conexión al guardar el registro.");
    } finally {
        btnGuardar.innerText = "Guardar Registro"; btnGuardar.disabled = false;
    }
});

// ================= LÓGICA DEL PLANEADOR DE ACTIVIDADES =================
// Oculta la agenda y prepara la vista del Planeador Financiero
window.abrirModalCierre = function() {
    document.getElementById('barra-bitacora').style.display = 'none';
    cargarPlaneador(false); // false = Indica modo de vista para el Técnico
};

// Restaura la vista de la agenda
window.volverAgenda = function() {
    document.getElementById('contenedor-planeador').style.display = 'none';
    document.getElementById('contenedor-agenda').style.display = 'block';
    document.getElementById('barra-bitacora').style.display = 'flex';
};

// Construye la tabla financiera consultando los datos del servidor
async function cargarPlaneador(esModoMesaControl) {
    document.getElementById('contenedor-agenda').style.display = 'none';
    document.getElementById('contenedor-planeador').style.display = 'block';

    try {
        const respuesta = await fetch(BASE_URL + `/api/bitacoras/resumen/${idBitacoraDiaria}`);
        const datos = await respuesta.json();
        
        let htmlTabla = '';
        let sumaCosto = 0, sumaIngreso = 0, sumaGasto = 0;

        // 1. Dibuja las filas de los Servicios Completados
        datos.servicios.forEach(srv => {
            const hora = new Date(srv.fecha_programada).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const costo = parseFloat(srv.costo) || 0;
            const ingreso = parseFloat(srv.ingresos_cobrados) || 0;
            sumaCosto += costo; sumaIngreso += ingreso;

            htmlTabla += `
                <tr>
                    <td>${hora}<br><span class="badge bg-secondary">${srv.id_orden}</span></td>
                    <td><strong>${srv.nombre_cliente}</strong><br><small class="text-muted">${srv.tipo_servicio}</small></td>
                    <td>$${costo.toFixed(2)}</td>
                    <td class="text-primary fw-bold">$${ingreso.toFixed(2)}</td>
                    <td>$0.00</td>
                </tr>`;
        });

        // 2. Dibuja las filas de las Actividades Extra
        const extras = datos.bitacora.actividades_extra || [];
        extras.forEach(ext => {
            const costo = parseFloat(ext.costo) || 0;
            const ingreso = parseFloat(ext.ingreso) || 0;
            const gasto = parseFloat(ext.gasto) || 0;
            sumaCosto += costo; sumaIngreso += ingreso; sumaGasto += gasto;

            htmlTabla += `
                <tr class="table-warning">
                    <td>${ext.hora}<br><span class="badge bg-warning text-dark">N/A</span></td>
                    <td>${ext.descripcion}</td>
                    <td>$${costo.toFixed(2)}</td>
                    <td class="text-primary fw-bold">$${ingreso.toFixed(2)}</td>
                    <td class="text-danger fw-bold">$${gasto.toFixed(2)}</td>
                </tr>`;
        });

        // 3. Imprime los totales matemáticos en el pie de la tabla
        document.getElementById('tabla-planeador-body').innerHTML = htmlTabla;
        document.getElementById('tot-costo').innerText = `$${sumaCosto.toFixed(2)}`;
        document.getElementById('tot-ingreso').innerText = `$${sumaIngreso.toFixed(2)}`;
        document.getElementById('tot-gasto').innerText = `$${sumaGasto.toFixed(2)}`;
        
        totalEfectivoCalculado = sumaIngreso - sumaGasto;
        document.getElementById('gran-total-efectivo').innerText = `$${totalEfectivoCalculado.toFixed(2)}`;

        // 4. Configura la visualización de los paneles de firma según el usuario activo
        if (esModoMesaControl) {
            document.getElementById('btn-volver-agenda').style.display = 'none';
            document.getElementById('seccion-firma-tecnico').style.display = 'none';
            document.getElementById('seccion-firma-mesa').style.display = 'block';
            
            // Renderiza la firma almacenada del técnico
            const firmas = datos.bitacora.firmas_cierre || {};
            document.getElementById('img-firma-tecnico').src = firmas.tecnico || '';
        } else {
            document.getElementById('seccion-firma-tecnico').style.display = 'block';
            document.getElementById('seccion-firma-mesa').style.display = 'none';
        }

    } catch (error) {
        alert("Error al generar el planeador.");
    }
}

// ================= FORMULARIOS DE CIERRE Y LIQUIDACIÓN =================
document.getElementById('form-cierre-ruta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const canvas = document.getElementById('canvas-firma-tecnico');
    
    // Valida la existencia de la firma en el lienzo
    if (canvas.getAttribute('data-firmada') !== 'true') {
        alert("⚠️ Es obligatorio dibujar tu firma para cerrar la ruta.");
        return;
    }

    // Compara el kilometraje final contra el inicial registrado en la memoria
    const kmFinal = parseFloat(document.getElementById('cr-km-final').value);
    if (kmFinal < kmInicialDia) {
        alert(`❌ Error lógico: El KM final (${kmFinal}) no puede ser menor al inicial (${kmInicialDia}).`);
        return;
    }

    const btn = document.getElementById('btn-guardar-cierre');
    btn.innerText = "Guardando..."; btn.disabled = true;

    try {
        const respuesta = await fetch(BASE_URL + '/api/bitacoras/cerrar-ruta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_bitacora: idBitacoraDiaria,
                km_final: kmFinal,
                firma_tecnico: canvas.toDataURL("image/png")
            })
        });
        const datos = await respuesta.json();
        
        if (datos.exito) {
            alert("Ruta cerrada. Ahora entrega el dispositivo en Mesa de Control.");
            // Ejecuta la transición automática a la vista de Mesa de Control
            cargarPlaneador(true);
        }
    } catch (error) {
        alert("Error de conexión al cerrar.");
        btn.innerText = "Bloquear y Cerrar Ruta"; btn.disabled = false;
    }
});

document.getElementById('form-liquidar-ruta').addEventListener('submit', async (e) => {
    e.preventDefault();
    const canvas = document.getElementById('canvas-firma-mesa');
    
    // Valida la existencia de la firma de responsabilidad
    if (canvas.getAttribute('data-firmada') !== 'true') {
        alert("⚠️ La firma de Mesa de Control es obligatoria.");
        return;
    }

    const btn = document.getElementById('btn-guardar-liquidacion');
    btn.innerText = "Liquidando..."; btn.disabled = true;

    try {
        const respuesta = await fetch(BASE_URL + '/api/bitacoras/entregar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_bitacora: idBitacoraDiaria,
                firma_responsable: canvas.toDataURL("image/png"),
                total_entregado: totalEfectivoCalculado
            })
        });
        const datos = await respuesta.json();
        
        if (datos.exito) {
            // Refresca la aplicación para renderizar la pantalla final de éxito
            window.location.reload(); 
        }
    } catch (error) {
        alert("Error de conexión.");
        btn.innerText = "Recibir Efectivo y Liquidar"; btn.disabled = false;
    }
});

// ================= SISTEMA DINÁMICO DE DIBUJO (CANVAS) =================
// Configura los eventos de interacción para habilitar el dibujo en los lienzos
function iniciarCanvas(idElemento) {
    const canvas = document.getElementById(idElemento);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Aplica los estilos visuales del trazo
    ctx.lineWidth = 3; 
    ctx.lineCap = 'round'; 
    ctx.strokeStyle = '#000000';
    let dibujando = false;

    // Calcula la posición relativa del cursor o dedo sobre el lienzo
    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const iniciar = (e) => { 
        e.preventDefault(); dibujando = true; 
        canvas.setAttribute('data-firmada', 'true'); 
        const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); 
    };
    
    const dibujar = (e) => { 
        e.preventDefault(); if (!dibujando) return; 
        const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); 
    };
    
    const detener = () => { dibujando = false; ctx.closePath(); };

    // Asigna los eventos correspondientes a mouse (PC) y touch (Móvil)
    canvas.addEventListener('mousedown', iniciar);
    canvas.addEventListener('mousemove', dibujar);
    canvas.addEventListener('mouseup', detener);
    canvas.addEventListener('mouseout', detener);
    canvas.addEventListener('touchstart', iniciar, { passive: false });
    canvas.addEventListener('touchmove', dibujar, { passive: false });
    canvas.addEventListener('touchend', detener);
}

// Restablece el lienzo eliminando cualquier trazo existente
window.limpiarCanvas = function(idElemento) {
    const canvas = document.getElementById(idElemento);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.setAttribute('data-firmada', 'false');
};

// ================= ACCIONES SECUNDARIAS =================
window.abrirOrden = function(idOrden, estatus) {
    if (estatus === 'Pendiente') {
        const modalBloqueo = new bootstrap.Modal(document.getElementById('modalBloqueo'));
        modalBloqueo.show();
        return; 
    }
    if (!localStorage.getItem('hora_inicio_' + idOrden)) {
        localStorage.setItem('hora_inicio_' + idOrden, new Date().toISOString());
    }
    window.location.href = `orden.html?folio=${idOrden}`;
};

// ================= GESTIÓN DE MIS PLANEADORES (VISTA TÉCNICO) =================

// Alterna la visibilidad entre la Agenda del día y el Historial de Planeadores
window.toggleMisPlaneadores = function() {
    const divAgenda = document.getElementById('contenedor-agenda');
    const divPlaneadores = document.getElementById('contenedor-mis-planeadores');
    const divLiquidacion = document.getElementById('contenedor-planeador');
    const titulo = document.getElementById('titulo-agenda');
    const btn = document.getElementById('btn-mis-planeadores');

    if (divPlaneadores.style.display === 'none') {
        // Modo: Ver Historial de Planeadores
        divAgenda.style.display = 'none';
        divLiquidacion.style.display = 'none';
        document.getElementById('barra-bitacora').style.display = 'none';
        divPlaneadores.style.display = 'block';
        
        titulo.innerText = "Mis Planeadores";
        btn.innerText = "Volver a la Agenda";
        cargarListaPlaneadores();
    } else {
        // Modo: Volver a la Agenda normal
        window.location.reload(); // La forma más limpia de restaurar el estado
    }
};

// Descarga y dibuja las tarjetas del historial del técnico
window.cargarListaPlaneadores = async function() {
    const idUsuario = localStorage.getItem('idUsuario');
    const contenedor = document.getElementById('lista-planeadores');
    document.getElementById('cargando-planeadores').style.display = 'block';
    contenedor.innerHTML = '';

    try {
        const respuesta = await fetch(BASE_URL + `/api/bitacoras/tecnico/${idUsuario}`);
        const datos = await respuesta.json();
        document.getElementById('cargando-planeadores').style.display = 'none';

        if (datos.exito && datos.bitacoras.length > 0) {
            let html = '';
            datos.bitacoras.forEach(b => {
                // Genera la fecha en formato legible (evitando el desfase de zona horaria)
                const fechaDate = new Date(b.fecha_jornada);
                const fechaAjustada = new Date(fechaDate.getTime() + (fechaDate.getTimezoneOffset() * 60000));
                const fechaTxt = fechaAjustada.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                
                let colorBorde = 'border-secondary';
                let estatusHtml = '';
                let btnAccion = '';

                // Define el aspecto visual y el botón según el estatus de la bitácora
                if (b.estatus === 'En_Ruta') {
                    colorBorde = 'border-warning';
                    estatusHtml = '<span class="badge bg-warning text-dark">🚚 En Ruta</span>';
                    btnAccion = `<button class="btn btn-outline-warning btn-sm fw-bold w-100 mt-2 text-dark" onclick="window.location.reload()">Ir a la Agenda Actual</button>`;
                } else if (b.estatus === 'Cerrada_Ruta') {
                    colorBorde = 'border-danger';
                    estatusHtml = '<span class="badge bg-danger">🔒 Ruta Cerrada (Falta Liquidar)</span>';
                    btnAccion = `<button class="btn btn-primary btn-sm fw-bold w-100 mt-2 shadow-sm" onclick="prepararLiquidacion(${b.id_bitacora})">Entregar a Mesa de Control</button>`;
                } else if (b.estatus === 'Entregada') {
                    colorBorde = 'border-success';
                    estatusHtml = '<span class="badge bg-success">✅ Liquidada</span>';
                    btnAccion = `<a href="../viewmesacontrol/planeadoractividadestecnico/imprimir_planeador.html?id=${b.id_bitacora}" class="btn btn-outline-success btn-sm fw-bold w-100 mt-2">🖨️ Ver Formato Final</a>`;
                }

                html += `
                    <div class="card mb-3 shadow-sm border-start ${colorBorde} border-4">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-2">
                                <h6 class="card-title mb-0 fw-bold text-capitalize">${fechaTxt}</h6>
                                <span class="badge bg-light text-dark border">Folio: ${b.id_bitacora}</span>
                            </div>
                            <div class="mb-2">${estatusHtml}</div>
                            ${btnAccion}
                        </div>
                    </div>
                `;
            });
            contenedor.innerHTML = html;
        } else {
            contenedor.innerHTML = '<div class="alert alert-light border text-center text-muted">No tienes planeadores registrados.</div>';
        }
    } catch (error) {
        document.getElementById('cargando-planeadores').style.display = 'none';
        contenedor.innerHTML = '<div class="alert alert-danger">Error al cargar el historial.</div>';
    }
};

// Inyecta el ID del planeador seleccionado y abre la vista de firmas de Mesa de Control
window.prepararLiquidacion = function(idBitacoraSeleccionada) {
    idBitacoraDiaria = idBitacoraSeleccionada; 
    document.getElementById('contenedor-mis-planeadores').style.display = 'none';
    cargarPlaneador(true); 
};

window.cerrarSesion = function() {
    localStorage.clear();
    window.location.href = "../index.html";
};