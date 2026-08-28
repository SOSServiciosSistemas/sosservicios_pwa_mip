// ================= CONFIGURACIÓN DE ENTORNO =================
const BASE_URL = 'http://localhost:3000';
let todasLasBitacoras = []; // Variable global para guardar los planeadores

// ================= CONFIGURACIÓN INICIAL =================
document.addEventListener('DOMContentLoaded', () => {
    const idUsuario = localStorage.getItem('idUsuario');
    const nombreUsuario = localStorage.getItem('nombreUsuario');
    const rolUsuario = localStorage.getItem('rolUsuario');

    // Seguridad
    if (!idUsuario || rolUsuario !== 'Mesa_Control') {
        window.location.href = "../index.html";
        return;
    }
    document.getElementById('nombre-usuario-nav').innerText = `Hola, ${nombreUsuario}`;

    // Configurar la casilla del historial para que inicie en el mes actual automáticamente
    const hoy = new Date();
    const mesStr = (hoy.getMonth() + 1).toString().padStart(2, '0');
    document.getElementById('filtro-mes').value = `${hoy.getFullYear()}-${mesStr}`;

    // Inicializar Calendario
    var calendarEl = document.getElementById('calendario');
    window.calendarioPrincipal = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'es',
        buttonText: {
            today: 'Hoy',
            month: 'Mes',
            list: 'Lista'
        },
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,listWeek'
        },
        editable: true,
        eventDisplay: 'block',
        displayEventTime: true,
        
        events: BASE_URL + '/api/agenda-general',
        
        eventDrop: async function(info) {
            const idOrden = info.event.id;
            const nuevaFechaObj = info.event.start;
            
            // ================= ESCUDO ANTI-MODIFICACIÓN DE REPORTES =================
            if (info.event.extendedProps.estatus === 'Completado') {
                alert("🔒 Este servicio ya está COMPLETADO.\n\nNo se puede mover de fecha para proteger la integridad del reporte generado por el técnico.");
                info.revert(); 
                return; 
            }
            // ========================================================================
            
            const diaVisual = nuevaFechaObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
            
            const nuevaHora = await new Promise((resolve) => {
                document.getElementById('dd-texto-folio').innerText = idOrden;
                document.getElementById('dd-texto-dia').innerText = capitalizarTexto(diaVisual);
                document.getElementById('dd-nueva-hora').value = '09:00';

                const modalEl = document.getElementById('modalConfirmarDragDrop');
                const modal = new bootstrap.Modal(modalEl);
                modal.show();

                const btnAceptar = document.getElementById('btn-aceptar-dd');
                const btnCancelar = document.getElementById('btn-cancelar-dd');

                btnAceptar.onclick = () => {
                    const horaSeleccionada = document.getElementById('dd-nueva-hora').value;
                    if(horaSeleccionada) {
                        modal.hide();
                        resolve(horaSeleccionada);
                    } else {
                        alert("Por favor selecciona una hora.");
                    }
                };

                btnCancelar.onclick = () => {
                    modal.hide();
                    resolve(null);
                };

                modalEl.addEventListener('hidden.bs.modal', function handler() {
                    modalEl.removeEventListener('hidden.bs.modal', handler);
                    resolve(null); 
                });
            });

            if (!nuevaHora) {
                info.revert(); 
                return;
            }

            const año = nuevaFechaObj.getFullYear();
            const mes = String(nuevaFechaObj.getMonth() + 1).padStart(2, '0');
            const dia = String(nuevaFechaObj.getDate()).padStart(2, '0');
            const fechaParaDB = `${año}-${mes}-${dia} ${nuevaHora}:00`;

            try {
                const respuesta = await fetch(BASE_URL + `/api/ordenes/${idOrden}/reagendar`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fecha_programada: fechaParaDB })
                });
                
                const datos = await respuesta.json();

                if (datos.exito) {
                    window.calendarioPrincipal.refetchEvents();
                    if (typeof window.cargarHistorial === 'function') window.cargarHistorial();
                } else {
                    alert("Error en el servidor: " + datos.error);
                    info.revert();
                }
            } catch(error) {
                alert("Error de conexión al reagendar el servicio.");
                info.revert();
            }
        },
        eventClick: function(info) {
            const idOrden = info.event.id;
            const tituloLimpio = info.event.title.replace('✔ ', '').replace('🕒 ', ''); 
            const estatusActual = info.event.extendedProps.estatus;
            
            const opcionesFecha = { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
            const fechaFormateada = info.event.start.toLocaleString('es-ES', opcionesFecha);

            document.getElementById('do-id-orden').value = idOrden;
            document.getElementById('do-cliente').innerText = tituloLimpio;
            document.getElementById('do-fecha').innerText = capitalizarTexto(fechaFormateada);
            
            const badgeEstatus = document.getElementById('do-estatus');
            badgeEstatus.innerText = estatusActual;
            let colorBadge = 'bg-secondary';
            if (estatusActual === 'Confirmado') colorBadge = 'bg-success';
            if (estatusActual === 'Cancelado') colorBadge = 'bg-danger';
            badgeEstatus.className = 'badge fs-6 px-3 py-2 ' + colorBadge;

            const cajaAcciones = document.getElementById('caja-acciones-servicio');
            const cajaBloqueo = document.getElementById('caja-bloqueo-completado');
            const btnEditar = document.getElementById('btn-editar-datos');

            if (estatusActual === 'Completado') {
                cajaAcciones.style.display = 'none';
                btnEditar.style.display = 'none'; 
                cajaBloqueo.style.display = 'block';
                badgeEstatus.className = 'badge fs-6 px-3 py-2 bg-primary'; 
            } else {
                cajaAcciones.style.display = 'block';
                btnEditar.style.display = 'inline-block';
                cajaBloqueo.style.display = 'none';

                const btnConfirmar = document.getElementById('btn-accion-confirmar');
                if (estatusActual === 'Confirmado') {
                    btnConfirmar.className = 'btn btn-warning fw-bold w-100 ms-2 text-dark';
                    btnConfirmar.innerHTML = '✖ Retirar confirmación';
                    btnConfirmar.onclick = function() { retirarConfirmacion(); };
                    badgeEstatus.className = 'badge fs-6 px-3 py-2 bg-success';
                } else {
                    btnConfirmar.className = 'btn btn-success fw-bold w-100 ms-2';
                    btnConfirmar.innerHTML = '✔ Marcar Confirmado';
                    btnConfirmar.onclick = function() { cambiarEstatusOrden('Confirmado'); };
                    badgeEstatus.className = 'badge fs-6 px-3 py-2 bg-secondary';
                }

                const btnCancelar = document.getElementById('btn-cancelar-orden');
                if (estatusActual === 'Cancelado') {
                    btnCancelar.className = 'btn btn-link text-success text-decoration-none p-0 fw-bold';
                    btnCancelar.innerHTML = '🔄 Reactivar este servicio y sus consecutivos';
                    btnCancelar.onclick = function() { cambiarEstatusOrden('Pendiente'); };
                    badgeEstatus.className = 'badge fs-6 px-3 py-2 bg-danger';
                } else {
                    btnCancelar.className = 'btn btn-link text-danger text-decoration-none p-0';
                    btnCancelar.innerHTML = 'Cancelar servicio definitivamente';
                    btnCancelar.onclick = function() { cambiarEstatusOrden('Cancelado'); };
                }
            }

            const modalEl = document.getElementById('modalDetalleOrden');
            const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
            modal.show();
        }
    });
    window.calendarioPrincipal.render();

    // Llenamos las listas desplegables al arrancar el sistema
    cargarFormularioAgenda();

    // Eventos para filtrar los planeadores en tiempo real
    document.getElementById('filtro-texto-planeador').addEventListener('input', filtrarPlaneadores);
    document.getElementById('filtro-estatus-planeador').addEventListener('change', filtrarPlaneadores);
});

// ================= NAVEGACIÓN =================
window.cambiarVista = function(vista, evento) {
    if(evento) evento.preventDefault();
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active', 'text-warning', 'fw-bold'));
    if(evento) {
        evento.target.classList.add('active');
        if (vista === 'planeadores') evento.target.classList.add('text-warning', 'fw-bold');
    }

    // Ocultar todas las vistas
    document.getElementById('seccion-clientes').style.display = 'none';
    document.getElementById('seccion-agenda').style.display = 'none';
    document.getElementById('seccion-historial').style.display = 'none';
    document.getElementById('seccion-planeadores').style.display = 'none';
    
    // Mostrar la vista elegida
    if(vista === 'clientes') {
        document.getElementById('seccion-clientes').style.display = 'block';
        cargarClientes(); 
    } else if(vista === 'agenda') {
        document.getElementById('seccion-agenda').style.display = 'block';
        setTimeout(() => window.calendarioPrincipal.render(), 100); 
    } else if(vista === 'historial') {
        document.getElementById('seccion-historial').style.display = 'block';
        cargarHistorial(); 
    } else if(vista === 'planeadores') {
        document.getElementById('seccion-planeadores').style.display = 'block';
        cargarPlaneadores();
    }
};

window.cerrarSesion = function() {
    localStorage.clear();
    window.location.href = "../index.html";
};

// ================= LÓGICA DE CLIENTES (GLOBALES) =================
window.cargarClientes = async function() {
    const tbody = document.getElementById('tbody-clientes');
    try {
        const respuesta = await fetch(BASE_URL + '/api/clientes');
        const datos = await respuesta.json();

        if (datos.exito && datos.clientes.length > 0) {
            tbody.innerHTML = ''; 
            datos.clientes.forEach(cliente => {
                let telefonoStr = (cliente.telefono && cliente.telefono.length > 0) ? cliente.telefono[0] : 'N/A';
                tbody.innerHTML += `
                    <tr data-direcciones="${cliente.direcciones || ''}">
                        <td class="fw-bold text-primary">${cliente.nombre}</td>
                        <td>${telefonoStr}</td>
                        <td><span class="badge bg-secondary">${cliente.clase || 'Sin clase'}</span></td>
                        <td class="text-center">
                            <button class="btn btn-sm btn-outline-primary fw-bold" onclick="abrirModalEditar(${cliente.id_cliente})">Ver / Editar</button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No hay clientes registrados en el sistema.</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error al conectar con el servidor.</td></tr>`;
    }
};

window.abrirModalEditar = async function(idCliente) {
    try {
        const respuesta = await fetch(BASE_URL + `/api/clientes/${idCliente}`);
        const datos = await respuesta.json();

        if(datos.exito) {
            const cliente = datos.cliente;
            document.getElementById('ec-id').value = cliente.id_cliente;
            document.getElementById('ec-nombre').value = cliente.nombre;
            document.getElementById('ec-contacto').value = cliente.contacto || '';
            document.getElementById('ec-telefono').value = (cliente.telefono && cliente.telefono.length > 0) ? cliente.telefono[0] : '';
            document.getElementById('ec-clase').value = cliente.clase || 'No prioritario';
            document.getElementById('ec-frecuencia').value = cliente.frecuencia || 'Única vez';
            document.getElementById('ec-giro').value = cliente.giro || '';
            document.getElementById('ec-correo').value = cliente.correo || '';
            document.getElementById('ec-razonsocial').value = cliente.razon_social || '';
            document.getElementById('ec-rfc').value = cliente.rfc || '';
            document.getElementById('ec-domiciliofiscal').value = cliente.domicilio_fiscal || '';

            const divUbicaciones = document.getElementById('lista-ubicaciones-cliente');
            divUbicaciones.innerHTML = '<span class="text-muted small">Cargando...</span>';
            
            const resUbi = await fetch(BASE_URL + `/api/ubicaciones/${idCliente}`);
            const datosUbi = await resUbi.json();
            
            if (datosUbi.exito && datosUbi.ubicaciones.length > 0) {
                let htmlUbi = '<ul class="list-group list-group-flush border shadow-sm rounded">';
                datosUbi.ubicaciones.forEach(u => {
                    htmlUbi += `
                        <li class="list-group-item d-flex justify-content-between align-items-center" style="font-size: 0.9rem;">
                            <div>
                                <strong class="text-dark">${u.nombre_ubicacion}</strong><br>
                                <span class="text-muted">${u.domicilio}, ${u.colonia}, ${u.ciudad}</span>
                            </div>
                        </li>`;
                });
                htmlUbi += '</ul>';
                divUbicaciones.innerHTML = htmlUbi;
            } else {
                divUbicaciones.innerHTML = '<div class="alert alert-light text-center small border mb-0">No hay ubicaciones registradas.</div>';
            }

            const modal = new bootstrap.Modal(document.getElementById('modalEditarCliente'));
            modal.show();
        }
    } catch (error) {
        alert("Error al cargar los datos del cliente.");
    }
};

function capitalizarTexto(texto) {
    if (!texto) return '';
    return texto.toLowerCase().split(' ').map(palabra => {
        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(' ');
}

document.getElementById('nc-nombre').addEventListener('blur', function() { this.value = capitalizarTexto(this.value); });
document.getElementById('nc-contacto').addEventListener('blur', function() { this.value = capitalizarTexto(this.value); });
document.getElementById('ec-contacto').addEventListener('blur', function() { this.value = capitalizarTexto(this.value); });
document.getElementById('nc-rfc').addEventListener('input', function() { this.value = this.value.toUpperCase(); });
document.getElementById('ec-rfc').addEventListener('input', function() { this.value = this.value.toUpperCase(); });

document.getElementById('form-nuevo-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnGuardar = document.getElementById('btn-guardar-cliente');
    btnGuardar.innerText = "Guardando..."; btnGuardar.disabled = true;

    const nuevoCliente = {
        nombre: capitalizarTexto(document.getElementById('nc-nombre').value),
        contacto: capitalizarTexto(document.getElementById('nc-contacto').value),
        telefono: document.getElementById('nc-telefono').value,
        clase: document.getElementById('nc-clase').value,
        frecuencia: document.getElementById('nc-frecuencia').value,
        giro: document.getElementById('nc-giro').value,
        correo: document.getElementById('nc-correo').value.toLowerCase(),
        razonSocial: document.getElementById('nc-razonsocial').value,
        rfc: document.getElementById('nc-rfc').value.toUpperCase(),
        domicilioFiscal: document.getElementById('nc-domiciliofiscal').value,
        domicilio: document.getElementById('nc-domicilio').value,
        colonia: document.getElementById('nc-colonia').value,
        ciudad: document.getElementById('nc-ciudad').value
    };

    try {
        const respuesta = await fetch(BASE_URL + '/api/clientes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoCliente)
        });

        if (!respuesta.ok) throw new Error("El servidor rechazó la petición.");

        const datos = await respuesta.json();
        if(datos.exito) {
            const modalElement = document.getElementById('modalNuevoCliente');
            let modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
            
            document.getElementById('form-nuevo-cliente').reset();
            cargarClientes();
            if (typeof window.cargarFormularioAgenda === 'function') window.cargarFormularioAgenda(); 
        }
    } catch (error) {
        alert("Atención: " + error.message);
    } finally {
        btnGuardar.innerText = "Guardar Cliente y Dirección"; btnGuardar.disabled = false;
    }
});

document.getElementById('form-editar-cliente').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnActualizar = document.getElementById('btn-actualizar-cliente');
    btnActualizar.innerText = "Actualizando..."; btnActualizar.disabled = true;

    const idCliente = document.getElementById('ec-id').value;
    const clienteActualizado = {
        contacto: capitalizarTexto(document.getElementById('ec-contacto').value),
        telefono: document.getElementById('ec-telefono').value,
        clase: document.getElementById('ec-clase').value,
        frecuencia: document.getElementById('ec-frecuencia').value,
        giro: document.getElementById('ec-giro').value,
        correo: document.getElementById('ec-correo').value.toLowerCase(),
        razonSocial: document.getElementById('ec-razonsocial').value,
        rfc: document.getElementById('ec-rfc').value.toUpperCase(),
        domicilioFiscal: document.getElementById('ec-domiciliofiscal').value
    };

    try {
        const respuesta = await fetch(BASE_URL + `/api/clientes/${idCliente}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clienteActualizado)
        });

        if (!respuesta.ok) throw new Error("El servidor rechazó la petición.");

        const datos = await respuesta.json();
        if(datos.exito) {
            const modalElement = document.getElementById('modalEditarCliente');
            let modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
            cargarClientes();
        }
    } catch (error) {
        alert("Atención: " + error.message);
    } finally {
        btnActualizar.innerText = "Actualizar Datos"; btnActualizar.disabled = false;
    }
});

window.abrirModalNuevaUbicacion = function() {
    document.getElementById('form-nueva-ubicacion').reset();
    document.getElementById('nu-ciudad').value = 'León'; 
    const modalNuevaUbi = new bootstrap.Modal(document.getElementById('modalNuevaUbicacion'));
    modalNuevaUbi.show();
};

document.getElementById('form-nueva-ubicacion').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnGuardar = document.getElementById('btn-guardar-ubicacion');
    btnGuardar.innerText = "Guardando..."; btnGuardar.disabled = true;

    const idCliente = document.getElementById('ec-id').value;
    const nuevaUbicacion = {
        id_cliente: idCliente,
        nombre_ubicacion: capitalizarTexto(document.getElementById('nu-nombre').value),
        domicilio: document.getElementById('nu-domicilio').value,
        colonia: document.getElementById('nu-colonia').value,
        ciudad: document.getElementById('nu-ciudad').value
    };

    try {
        const respuesta = await fetch(BASE_URL + '/api/ubicaciones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaUbicacion)
        });

        const datos = await respuesta.json();
        
        if (datos.exito) {
            const modalElement = document.getElementById('modalNuevaUbicacion');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            
            abrirModalEditar(idCliente);
            if (typeof window.cargarFormularioAgenda === 'function') window.cargarFormularioAgenda();
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        alert("Error de conexión al guardar la ubicación.");
    } finally {
        btnGuardar.innerText = "Guardar Ubicación"; btnGuardar.disabled = false;
    }
});

window.cargarFormularioAgenda = async function() {
    try {
        const resTecnicos = await fetch(BASE_URL + '/api/tecnicos');
        const datosTecnicos = await resTecnicos.json();
        const selectTecnico = document.getElementById('no-tecnico');
        selectTecnico.innerHTML = '<option value="">Seleccione un técnico...</option>';
        if(datosTecnicos.exito) {
            datosTecnicos.tecnicos.forEach(t => {
                selectTecnico.innerHTML += `<option value="${t.id_usuario}">${t.nombre_completo}</option>`;
            });
        }

        const resClientes = await fetch(BASE_URL + '/api/clientes');
        const datosClientes = await resClientes.json();
        const selectCliente = document.getElementById('no-cliente');
        selectCliente.innerHTML = '<option value="">Seleccione un cliente...</option>';
        if(datosClientes.exito) {
            datosClientes.clientes.forEach(c => {
                selectCliente.innerHTML += `<option value="${c.id_cliente}">${c.nombre}</option>`;
            });
        }
    } catch (error) {
        console.error('Error al cargar datos del formulario:', error);
    }
};

document.getElementById('no-cliente').addEventListener('change', async function() {
    const idCliente = this.value;
    const selectUbicacion = document.getElementById('no-ubicacion');
    
    if(!idCliente) {
        selectUbicacion.innerHTML = '<option value="">Primero seleccione un cliente...</option>';
        selectUbicacion.disabled = true;
        return;
    }

    selectUbicacion.innerHTML = '<option value="">Buscando ubicaciones...</option>';
    selectUbicacion.disabled = true;

    try {
        const respuesta = await fetch(BASE_URL + `/api/ubicaciones/${idCliente}`);
        const datos = await respuesta.json();
        
        selectUbicacion.innerHTML = '<option value="">Seleccione la ubicación...</option>';
        if(datos.exito && datos.ubicaciones.length > 0) {
            datos.ubicaciones.forEach(u => {
                selectUbicacion.innerHTML += `<option value="${u.id_ubicacion}">${u.nombre_ubicacion} - ${u.domicilio}, ${u.colonia}</option>`;
            });
            selectUbicacion.disabled = false;
        } else {
            selectUbicacion.innerHTML = '<option value="">No hay ubicaciones registradas</option>';
        }
    } catch (error) {
        selectUbicacion.innerHTML = '<option value="">Error de conexión</option>';
    }
});

document.getElementById('p-otros').addEventListener('change', function() {
    const inputOtros = document.getElementById('p-otros-texto');
    inputOtros.disabled = !this.checked;
    if(!this.checked) inputOtros.value = ''; 
});

const inputTipoServicio = document.getElementById('no-tipo-servicio');
const inputNumTrat = document.getElementById('no-num-tratamiento');
const inputTotalTrat = document.getElementById('no-total-tratamientos');
const contFrecuencia = document.getElementById('contenedor-frecuencia');
const seccionPlagas = document.getElementById('seccion-plagas');

inputTipoServicio.addEventListener('change', function() {
    if (this.value === 'Diagnóstico' || this.value === 'Inspección') {
        inputNumTrat.value = 0;
        inputTotalTrat.value = 0;
        inputNumTrat.readOnly = true;
        inputTotalTrat.readOnly = true;
        contFrecuencia.style.display = 'none';
        seccionPlagas.style.display = 'none';
        document.querySelectorAll('.chk-plaga').forEach(chk => chk.checked = false);
    } else {
        inputNumTrat.value = 1;
        inputTotalTrat.value = 1;
        inputNumTrat.readOnly = false;
        inputTotalTrat.readOnly = false;
        seccionPlagas.style.display = 'block';
    }
});

inputTotalTrat.addEventListener('input', function() {
    if (parseInt(this.value) > 1 && inputTipoServicio.value === 'Aplicación') {
        contFrecuencia.style.display = 'block';
    } else {
        contFrecuencia.style.display = 'none';
    }
});

inputNumTrat.addEventListener('input', function() {
    if (this.value === '1' && inputTipoServicio.value === 'Aplicación') {
        seccionPlagas.style.display = 'block';
    } else {
        seccionPlagas.style.display = 'none';
        document.querySelectorAll('.chk-plaga').forEach(chk => chk.checked = false);
    }
});

document.getElementById('form-nueva-orden').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fechaSeleccionada = document.getElementById('no-fecha').value;
    const añoIngresado = new Date(fechaSeleccionada).getFullYear();
    if (añoIngresado > 2099 || añoIngresado < 2024) {
        alert("⚠️ El año ingresado no es válido. Revisa que no hayas escrito dígitos de más (Ej. 20265).");
        return; 
    }

    const btnGuardar = document.getElementById('btn-guardar-orden');
    btnGuardar.innerText = "Agendando..."; 
    btnGuardar.disabled = true;

    let plagasSeleccionadas = [];
    document.querySelectorAll('.chk-plaga:checked').forEach(chk => {
        if(chk.value === 'Otros') {
            plagasSeleccionadas.push("Otros: " + document.getElementById('p-otros-texto').value);
        } else {
            plagasSeleccionadas.push(chk.value);
        }
    });

    const nuevaOrden = {
        id_ubicacion: document.getElementById('no-ubicacion').value,
        id_tecnico: document.getElementById('no-tecnico').value,
        fecha_programada: document.getElementById('no-fecha').value,
        tipo_servicio: inputTipoServicio.value,
        observaciones_mesa: document.getElementById('no-observaciones').value,
        costo: document.getElementById('no-costo').value || 0,
        num_tratamiento: inputNumTrat.value,
        total_tratamientos: inputTotalTrat.value,
        frecuencia: document.getElementById('no-frecuencia').value,
        plagas_a_tratar: JSON.stringify(plagasSeleccionadas)
    };

    try {
        const respuesta = await fetch(BASE_URL + '/api/ordenes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaOrden)
        });

        if (!respuesta.ok) throw new Error("El servidor rechazó la petición.");

        const datos = await respuesta.json();
        
        if(datos.exito) {
            const modalElement = document.getElementById('modalNuevaOrden');
            let modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.hide();
            
            document.getElementById('form-nueva-orden').reset();
            const selectUbicacion = document.getElementById('no-ubicacion');
            selectUbicacion.innerHTML = '<option value="">Primero seleccione un cliente...</option>';
            selectUbicacion.disabled = true;
            
            window.calendarioPrincipal.refetchEvents();
        }
    } catch (error) {
        alert("Atención: " + error.message);
    } finally {
        btnGuardar.innerText = "Agendar Servicio"; 
        btnGuardar.disabled = false;
    }
});

window.cambiarEstatusOrden = async function(nuevoEstatus) {
    if (nuevoEstatus === 'Cancelado') {
        const confirmacion = confirm("⚠️ ATENCIÓN:\n\n¿Estás seguro de que deseas CANCELAR este servicio definitivamente?\n\nSi pertenece a una serie de tratamientos, las visitas futuras pendientes también se cancelarán.");
        if (!confirmacion) return; 
    }

    const idOrden = document.getElementById('do-id-orden').value;
    
    try {
        const respuesta = await fetch(BASE_URL + `/api/ordenes/${idOrden}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estatus: nuevoEstatus })
        });

        if (respuesta.ok) {
            const modalElement = document.getElementById('modalDetalleOrden');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            window.calendarioPrincipal.refetchEvents();
        } else {
            alert('No se pudo actualizar el servicio.');
        }
    } catch (error) {
        alert('Error de conexión con el servidor.');
    }
};

window.reagendarOrden = function() {
    const modalDetalleElement = document.getElementById('modalDetalleOrden');
    const modalDetalle = bootstrap.Modal.getInstance(modalDetalleElement);
    modalDetalle.hide();
    
    const idOrden = document.getElementById('do-id-orden').value;
    document.getElementById('ro-id-orden').value = idOrden;
    document.getElementById('ro-nueva-fecha').value = ''; 
    
    const modalReagendar = new bootstrap.Modal(document.getElementById('modalReagendarOrden'));
    modalReagendar.show();
};

document.getElementById('form-reagendar-orden').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nuevaFecha = document.getElementById('ro-nueva-fecha').value;
    
    const añoIngresado = new Date(nuevaFecha).getFullYear();
    if (añoIngresado > 2099 || añoIngresado < 2024) {
        alert("⚠️ El año ingresado no es válido. Revisa que no hayas escrito dígitos de más (Ej. 20265).");
        return; 
    }

    const btnGuardar = document.getElementById('btn-guardar-reagendo');
    btnGuardar.innerText = "Guardando..."; 
    btnGuardar.disabled = true;
    const idOrden = document.getElementById('ro-id-orden').value;

    try {
        const respuesta = await fetch(BASE_URL + `/api/ordenes/${idOrden}/reagendar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha_programada: nuevaFecha })
        });

        if (respuesta.ok) {
            const modalElement = document.getElementById('modalReagendarOrden');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            window.calendarioPrincipal.refetchEvents();
        } else {
            alert('No se pudo reagendar el servicio.');
        }
    } catch (error) {
        alert('Error de conexión con el servidor.');
    } finally {
        btnGuardar.innerText = "Confirmar Cambio"; 
        btnGuardar.disabled = false;
    }
});

window.retirarConfirmacion = function() {
    const mensajeAdvertencia = "¿Estás seguro que deseas retirar la confirmación de visita para este servicio?\n\nRecuerda que para esto requieres haber consultado de antemano al cliente.";
    const estaSeguro = confirm(mensajeAdvertencia);
    if (estaSeguro) cambiarEstatusOrden('Pendiente');
};

// ================= LÓGICA DEL HISTORIAL DE SERVICIOS =================
window.cargarHistorial = async function() {
    const tbody = document.getElementById('tbody-historial');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Cargando historial...</td></tr>';
    
    try {
        const respuesta = await fetch(BASE_URL + '/api/historial-ordenes');
        const datos = await respuesta.json();

        if (datos.exito && datos.historial.length > 0) {
            tbody.innerHTML = ''; 
            datos.historial.forEach(orden => {
                const fecha = new Date(orden.fecha_programada).toLocaleString('es-ES', { 
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' 
                });
                
                let colorBadge = 'bg-secondary';
                if (orden.estatus === 'Confirmado') colorBadge = 'bg-success';
                if (orden.estatus === 'Cancelado') colorBadge = 'bg-danger';
                if (orden.estatus === 'Completado') colorBadge = 'bg-primary'; 

                const direccionCompleta = `${orden.domicilio || ''} ${orden.colonia || ''} ${orden.ciudad || ''}`;
                const dateObj = new Date(orden.fecha_programada);
                const mesOculto = dateObj.getFullYear() + "-" + (dateObj.getMonth() + 1).toString().padStart(2, '0');

                let botonesAccion = '';
                if (orden.estatus === 'Completado') {
                    botonesAccion = `<br><button class="btn btn-sm btn-outline-info fw-bold mt-2" onclick="abrirVisorReporte(${orden.id_orden})">📄 Ver Reporte</button>`;
                } else {
                    botonesAccion = `<br><button class="btn btn-sm btn-outline-secondary fw-bold mt-2" onclick="abrirModalEditarOrden(${orden.id_orden})">✏️ Editar Datos</button>`;
                }

                tbody.innerHTML += `
                    <tr data-direccion="${direccionCompleta}" data-mes="${mesOculto}">
                        <td class="text-muted fw-bold">${fecha}</td>
                        <td class="fw-bold text-primary">${orden.nombre_cliente}</td>
                        <td>${orden.nombre_tecnico}</td>
                        <td>${orden.tipo_servicio} ${botonesAccion}</td>
                        <td><span class="badge ${colorBadge}">${orden.estatus}</span></td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No hay servicios registrados en el historial.</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">Error al conectar con el servidor.</td></tr>`;
    }
};

function normalizarTexto(texto) {
    if (!texto) return '';
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

window.filtrarClientes = function() {
    const textoBuscado = normalizarTexto(document.getElementById('buscador-clientes').value);
    const filas = document.querySelectorAll('#tbody-clientes tr'); 

    filas.forEach(fila => {
        const contenidoVisible = fila.innerText; 
        const direccionesOcultas = fila.getAttribute('data-direcciones') || "";
        const contenidoTotal = normalizarTexto(contenidoVisible + " " + direccionesOcultas);
        
        if (contenidoTotal.includes(textoBuscado)) fila.style.display = ''; 
        else fila.style.display = 'none'; 
    });
};

window.filtrarHistorial = function() {
    const textoBuscado = normalizarTexto(document.getElementById('buscador-historial').value);
    const estatusSeleccionado = normalizarTexto(document.getElementById('filtro-estatus').value);
    const mesSeleccionado = document.getElementById('filtro-mes').value; 
    const filas = document.querySelectorAll('#tbody-historial tr');

    filas.forEach(fila => {
        const contenidoVisible = fila.innerText;
        const direccionOculta = fila.getAttribute('data-direccion') || "";
        const contenidoFila = normalizarTexto(contenidoVisible + " " + direccionOculta);
        
        const textoEstatusFila = normalizarTexto(fila.querySelector('td:nth-child(5)')?.innerText || ""); 
        const mesFila = fila.getAttribute('data-mes') || ""; 

        const coincideConTexto = contenidoFila.includes(textoBuscado);
        const coincideConEstatus = (estatusSeleccionado === "" || textoEstatusFila.includes(estatusSeleccionado));
        const coincideConMes = (mesSeleccionado === "" || mesFila === mesSeleccionado);

        if (coincideConTexto && coincideConEstatus && coincideConMes) fila.style.display = '';
        else fila.style.display = 'none';
    });
};

window.abrirModalEditarOrden = async function(idOrdenDirecto) {
    const modalDetalleEl = document.getElementById('modalDetalleOrden');
    if (modalDetalleEl) {
        const modalDetalle = bootstrap.Modal.getInstance(modalDetalleEl);
        if (modalDetalle) modalDetalle.hide();
    }
    
    const idOrden = idOrdenDirecto || document.getElementById('do-id-orden').value;
    document.getElementById('eo-id-orden').value = idOrden;

    try {
        const resOrden = await fetch(BASE_URL + `/api/orden/${idOrden}`);
        const datosOrden = await resOrden.json();
        
        if (datosOrden.exito) {
            const o = datosOrden.orden;
            
            let fechaFormateada = '';
            if (o.fecha_programada) {
                const d = new Date(o.fecha_programada);
                fechaFormateada = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
            }

            document.getElementById('eo-fecha').value = fechaFormateada;
            document.getElementById('eo-tipo-servicio').value = o.tipo_servicio || '';
            document.getElementById('eo-costo').value = o.costo || 0;
            document.getElementById('eo-observaciones').value = o.observaciones_mesa || '';
            
            const resTecnicos = await fetch(BASE_URL + '/api/tecnicos');
            const datosTecnicos = await resTecnicos.json();
            const selectTecnico = document.getElementById('eo-tecnico');
            selectTecnico.innerHTML = '<option value="">Seleccione un técnico...</option>';
            if (datosTecnicos.exito) {
                datosTecnicos.tecnicos.forEach(t => {
                    selectTecnico.innerHTML += `<option value="${t.id_usuario}">${t.nombre_completo}</option>`;
                });
                if (o.id_tecnico) selectTecnico.value = o.id_tecnico;
            }

            const selectUbicacion = document.getElementById('eo-ubicacion');
            selectUbicacion.innerHTML = '<option value="">Cargando ubicaciones...</option>';
            if (o.id_cliente) {
                const resUbicaciones = await fetch(BASE_URL + `/api/ubicaciones/${o.id_cliente}`);
                const datosUbicaciones = await resUbicaciones.json();
                selectUbicacion.innerHTML = '';
                if (datosUbicaciones.exito && datosUbicaciones.ubicaciones.length > 0) {
                    datosUbicaciones.ubicaciones.forEach(u => {
                        selectUbicacion.innerHTML += `<option value="${u.id_ubicacion}">${u.nombre_ubicacion} - ${u.domicilio}, ${u.colonia}</option>`;
                    });
                    selectUbicacion.value = o.id_ubicacion;
                } else {
                    selectUbicacion.innerHTML = '<option value="">No hay ubicaciones extra</option>';
                }
            } else {
                selectUbicacion.innerHTML = `<option value="${o.id_ubicacion}">Ubicación actual (No se pudo cargar la lista)</option>`;
            }
            
            const alertaAnterior = document.getElementById('alerta-bloqueo-ubi');
            if (alertaAnterior) alertaAnterior.remove();

            if (o.total_tratamientos > 1) {
                selectUbicacion.disabled = true; 
                const mensajeAlerta = document.createElement('small');
                mensajeAlerta.id = 'alerta-bloqueo-ubi';
                mensajeAlerta.className = 'text-danger fw-bold d-block mt-2';
                mensajeAlerta.innerHTML = '🔒 Ubicación bloqueada. Al ser una serie de servicios, el domicilio no puede cambiarse para proteger la validez del certificado. Si el cliente cambió de sede, cancele las visitas restantes y agende una nueva orden.';
                selectUbicacion.parentElement.appendChild(mensajeAlerta);
            } else {
                selectUbicacion.disabled = false;
            }
            
            const modalEditar = new bootstrap.Modal(document.getElementById('modalEditarOrden'));
            modalEditar.show();
        } else {
            alert('No se encontró la información de la orden.');
        }
    } catch (error) {
        alert('Error de conexión al cargar datos.');
    }
};

document.getElementById('form-editar-orden').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fechaSeleccionada = document.getElementById('eo-fecha').value;
    const añoIngresado = new Date(fechaSeleccionada).getFullYear();
    if (añoIngresado > 2099 || añoIngresado < 2024) {
        alert("⚠️ El año ingresado no es válido. Verifica no tener dígitos extra.");
        return; 
    }

    const btnGuardar = document.getElementById('btn-guardar-edicion-orden');
    btnGuardar.innerText = "Guardando..."; 
    btnGuardar.disabled = true;

    const idOrden = document.getElementById('eo-id-orden').value;
    const datosEditados = {
        id_ubicacion: document.getElementById('eo-ubicacion').value,
        fecha_programada: fechaSeleccionada,
        id_tecnico: document.getElementById('eo-tecnico').value,
        tipo_servicio: document.getElementById('eo-tipo-servicio').value,
        costo: document.getElementById('eo-costo').value || 0,
        observaciones_mesa: document.getElementById('eo-observaciones').value
    };

    try {
        const respuesta = await fetch(BASE_URL + `/api/ordenes/${idOrden}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosEditados)
        });

        if (respuesta.ok) {
            const modalElement = document.getElementById('modalEditarOrden');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            
            window.calendarioPrincipal.refetchEvents();
            if (document.getElementById('seccion-historial').style.display === 'block') {
                window.cargarHistorial();
            }
        } else {
            alert('No se pudo guardar la edición.');
        }
    } catch (error) {
        alert('Error de conexión con el servidor.');
    } finally {
        btnGuardar.innerText = "Guardar Cambios y Actualizar Consecutivos"; 
        btnGuardar.disabled = false;
    }
});


// ================= HISTORIAL: VISOR DE REPORTE MIP =================
window.abrirVisorReporte = async function(idOrden) {
    const modal = new bootstrap.Modal(document.getElementById('modalVisorReporte'));
    modal.show();
    
    const contenedor = document.getElementById('vr-contenido');
    contenedor.className = "p-0 bg-light"; 
    contenedor.innerHTML = '<p class="text-center text-muted my-5">Generando formato de impresión...</p>';

    try {
        const resReporte = await fetch(BASE_URL + `/api/reportes-mip/${idOrden}`);
        const datosRep = await resReporte.json();

        const resOrden = await fetch(BASE_URL + `/api/orden/${idOrden}`);
        const datosOrd = await resOrden.json();

        if (datosRep.exito && datosRep.reporte && datosOrd.exito && datosOrd.orden) {
            const r = datosRep.reporte;
            const o = datosOrd.orden;

            let detalles = {};
            if (r.detalles_ejecucion) detalles = typeof r.detalles_ejecucion === 'string' ? JSON.parse(r.detalles_ejecucion) : r.detalles_ejecucion;
            
            let plagas = [];
            if (o.plagas_a_tratar) plagas = typeof o.plagas_a_tratar === 'string' ? JSON.parse(o.plagas_a_tratar) : o.plagas_a_tratar;

            const fechaServ = new Date(o.fecha_programada).toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'});
            const horaInicio = r.hora_inicio ? new Date(r.hora_inicio).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit', hour12:true}) : '---';
            const fechaAnt = o.fecha_servicio_anterior ? new Date(o.fecha_servicio_anterior).toLocaleDateString('es-ES') : '---';
            const telCliente = o.telefono && o.telefono.length > 0 ? o.telefono[0] : '';
            const costoFormat = o.ingresos_cobrados ? parseFloat(o.ingresos_cobrados).toFixed(0) : '0';

            const listaPlagas = [
                { id: "Cucarachas", col: 1 }, { id: "Alacranes", col: 2 }, { id: "Chinches", col: 3 },
                { id: "Hormigas", col: 1 },   { id: "Arañas", col: 2 },    { id: "Termitas", col: 3 },
                { id: "Grillos", col: 1 },    { id: "Tijerillas", col: 2 },{ id: "Pulgas", col: 3 },
                { id: "Garrapatas", col: 1 }, { id: "Ratones", col: 2 },   { id: "Roedores", col: 3 },
                { id: "Murciélagos", col: 1 },{ id: "Aves", col: 2 },      { id: "Otros", col: 3 }
            ];
            
            let col1 = '', col2 = '', col3 = '';
            listaPlagas.forEach(p => {
                const seleccionada = plagas.includes(p.id) || (p.id === 'Otros' && plagas.some(x => x.startsWith('Otros'))) ? 'background-color: #900; border-color: #900; box-shadow: inset 0 0 0 2px white;' : 'background-color: white;';
                const checkHTML = `<div style="margin-bottom: 3px; font-size: 11px;">
                    <span style="display:inline-block; width:18px; height:10px; border:2px solid black; border-radius: 4px; ${seleccionada} margin-right:5px; vertical-align:middle; -webkit-print-color-adjust: exact; print-color-adjust: exact;"></span>
                    ${p.id.toUpperCase()}
                </div>`;
                if (p.col === 1) col1 += checkHTML;
                if (p.col === 2) col2 += checkHTML;
                if (p.col === 3) col3 += checkHTML;
            });

            let tablaQuimicosHTML = '';
            const maxFilas = 4; 
            const letras = ['A', 'B', 'C', 'D'];
            
            for (let i = 0; i < maxFilas; i++) {
                const prod = (detalles.tabla_productos && detalles.tabla_productos[i]) ? detalles.tabla_productos[i] : {};
                tablaQuimicosHTML += `
                    <tr>
                        <td style="border: 1px solid black; padding: 3px; font-weight: bold; text-align: center;">${letras[i]}</td>
                        <td style="border: 1px solid black; padding: 3px;">${prod.nombre_comercial || ''}</td>
                        <td style="border: 1px solid black; padding: 3px; text-align: center;">${prod.dosis || ''}</td>
                        <td style="border: 1px solid black; padding: 3px;"></td>
                        <td style="border: 1px solid black; padding: 3px;"></td>
                        <td style="border: 1px solid black; padding: 3px; text-align: center;">${prod.gasto_real || ''}</td>
                        <td style="border: 1px solid black; padding: 3px;"></td>
                    </tr>
                `;
            }

            contenedor.innerHTML = `
                <div style="font-family: Arial, Helvetica, sans-serif; color: black; background-color: white; padding: 20px 30px; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
                    <div style="position: relative; text-align: center; margin-bottom: 10px;">
                        <img src="../img/logo-SOS-Plagas.webp" alt="SOS Plagas" style="height: 80px; object-fit: contain;">
                        <div style="position: absolute; top: 5px; right: 0; text-align: center; font-size: 11px; font-weight: bold;">
                            TIPO DE SERVICIO:<br>
                            <span style="font-family: 'Brush Script MT', 'Segoe Print', cursive; font-size: 24px; font-weight: normal; text-decoration: underline;">${o.tipo_servicio}</span>
                        </div>
                        <h5 style="font-weight: 900; margin: 5px 0 0 0; font-size: 15px; letter-spacing: 0.5px;">ORDEN DE SERVICIO</h5>
                        <p style="margin: 0; font-size: 11px; font-weight: bold;">ORD.SERV.- ${String(idOrden).padStart(3, '0')}</p>
                    </div>

                    <table style="width: 100%; font-size: 11px; font-weight: bold; margin-bottom: 8px; border-collapse: collapse;">
                        <tr>
                            <td style="width: 60px; padding-bottom: 3px;">FECHA:</td>
                            <td style="border-bottom: 1px solid black; text-align: center;">${fechaServ}</td>
                            <td style="width: 100px;"></td>
                            <td style="width: 50px; text-align: right; padding-right: 10px;">FOLIO:</td>
                            <td style="border-bottom: 1px solid black; text-align: center; width: 120px;">${idOrden}</td>
                        </tr>
                        <tr>
                            <td colspan="3"></td>
                            <td style="text-align: right; padding-right: 10px; padding-top: 3px;">HORARIO:</td>
                            <td style="border-bottom: 1px solid black; text-align: center; padding-top: 3px;">${horaInicio}</td>
                        </tr>
                    </table>

                    <table style="width: 100%; font-size: 11px; font-weight: bold; margin-bottom: 10px; border-collapse: collapse;">
                        <tr>
                            <td style="width: 70px; padding: 3px 0;">NOMBRE:</td>
                            <td colspan="3" style="border-bottom: 1px solid black;">${o.nombre_cliente.toUpperCase()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 3px 0;">DIRECCIÓN:</td>
                            <td colspan="3" style="border-bottom: 1px solid black;">${o.domicilio.toUpperCase()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 3px 0;">COLONIA:</td>
                            <td colspan="3" style="border-bottom: 1px solid black;">${(o.colonia || '').toUpperCase()}</td>
                        </tr>
                        <tr>
                            <td style="padding: 3px 0;">CIUDAD:</td>
                            <td style="border-bottom: 1px solid black; width: 45%;">${(o.ciudad || '').toUpperCase()}</td>
                            <td style="text-align: right; padding-right: 10px; width: 50px;">TEL:</td>
                            <td style="border-bottom: 1px solid black; text-align: center;">${telCliente}</td>
                        </tr>
                    </table>

                    <div style="background-color: #f2f4f4; border: 1px solid #ccc; padding: 8px; margin-bottom: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                        <div style="text-align: center; font-weight: 900; font-size: 12px; margin-bottom: 5px; color: #1a5276;">PLAGAS A TRATAR</div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold;">
                            <div style="width: 33%;">${col1}</div>
                            <div style="width: 33%;">${col2}</div>
                            <div style="width: 33%;">${col3}</div>
                        </div>
                    </div>

                    <div style="font-size: 11px; font-weight: bold; text-align: center; margin-bottom: 3px;">COMENTARIOS E INDICACIONES:</div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; margin-bottom: 3px; padding: 0 10px;">
                        <div>Fecha servicio anterior: <span style="margin-left: 20px;">${fechaAnt}</span></div>
                        <div>Tratamiento: <span style="margin: 0 15px;">${o.num_tratamiento || 1}</span> de <span style="margin-left: 15px;">${o.total_tratamientos || 1}</span></div>
                    </div>

                    <div style="background-color: #f1c40f; color: #c0392b; font-weight: bold; font-size: 11px; padding: 6px; margin-bottom: 10px; border-bottom: 2px solid black; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                        ANTECEDENTES: <span style="font-weight: normal;">${o.observaciones_mesa || 'Se realiza aplicación preventiva.'}</span>
                    </div>

                    <div style="font-size: 11px; font-weight: 900; color: #1a5276; margin-bottom: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">ACCIONES E INDICACIONES CORRECTIVAS:</div>
                    <div style="border-bottom: 1px solid black; min-height: 16px; margin-bottom: 5px; font-size: 11px; padding-left: 5px;">${detalles.acciones_correctivas || ''}</div>
                    <div style="border-bottom: 1px solid black; min-height: 16px; margin-bottom: 10px;"></div>

                    <div style="font-size: 11px; font-weight: 900; color: #1a5276; margin-bottom: 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">INDICACIONES PROX SERVICIO:</div>
                    <div style="border-bottom: 1px solid black; min-height: 16px; margin-bottom: 5px; font-size: 11px; padding-left: 5px;">${detalles.indicaciones_proximas || ''}</div>
                    
                    <div style="text-align: right; margin-bottom: 5px;">
                        <div style="display: inline-block; border: 2px solid black; padding: 3px 15px; font-weight: bold; font-size: 14px;">
                            COSTO: <span style="font-family: 'Brush Script MT', cursive; font-size: 20px;">$ ${costoFormat}</span>
                        </div>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; font-size: 10px; text-align: center; margin-bottom: 10px;">
                        <thead>
                            <tr style="background-color: #e5e7e9; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                                <th style="border: 1px solid black; padding: 4px; width: 60px;">TIPO DE<br>PRODUCTO</th>
                                <th style="border: 1px solid black; padding: 4px;">NOMBRE COMERCIAL</th>
                                <th style="border: 1px solid black; padding: 4px; width: 60px;">Dosis<br>Ml / Lt</th>
                                <th style="border: 1px solid black; padding: 4px; width: 60px;">ANTERIOR</th>
                                <th style="border: 1px solid black; padding: 4px; width: 60px;">ENTRADA</th>
                                <th style="border: 1px solid black; padding: 4px; width: 60px;">SALIDA</th>
                                <th style="border: 1px solid black; padding: 4px; width: 60px;">SOBRANTE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${tablaQuimicosHTML}
                        </tbody>
                    </table>

                    <div style="display: flex; justify-content: space-between; text-align: center; font-size: 9px; font-weight: bold; margin-bottom: 5px;">
                        <div style="width: 25%; border: 2px solid black; border-radius: 10px; height: 60px; position: relative;">
                            <div style="position: absolute; bottom: 3px; width: 100%; border-top: 1px solid black; padding-top: 2px;">NOMBRE-FIRMA GERENTE</div>
                        </div>
                        <div style="width: 30%; text-align: center; color: #1a5276; font-size: 14px; font-weight: 900; display: flex; flex-direction: column; justify-content: flex-end; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                            <div style="margin-bottom: 5px;">PRÓXIMO<br>SERVICIO</div>
                            <div style="border: 2px solid black; border-radius: 8px; height: 25px;"></div>
                        </div>
                        <div style="width: 25%; border: 2px solid black; border-radius: 10px; height: 60px; position: relative;">
                            <div style="position: absolute; bottom: 3px; width: 100%; border-top: 1px solid black; padding-top: 2px;">NOMBRE-FIRMA DEL TÉCNICO</div>
                        </div>
                    </div>

                    <div style="text-align: center; font-size: 9px; font-weight: bold; border-top: 1px solid black; padding-top: 5px;">
                        TIPO DE SERVICIO: Aplicación, Garantía, Inspección, Presupuesto, Refuerzo, Complemento, Monitoreo.
                    </div>
                </div>
            `;
        } else {
            contenedor.innerHTML = `
                <div class="alert alert-warning text-center fw-bold border-0 shadow-sm m-3">
                    ⚠️ Aún no se ha sincronizado el reporte MIP para este servicio.<br>
                    <small class="fw-normal">Pide al técnico que cierre la orden desde su aplicación.</small>
                </div>
            `;
        }
    } catch (error) {
        contenedor.innerHTML = `<div class="alert alert-danger text-center">Error de conexión con el servidor.</div>`;
    }
};

// ================= FUNCIONES DE LA SECCIÓN PLANEADORES =================
window.cargarPlaneadores = async function() {
    const tbody = document.getElementById('tabla-planeadores-body');
    tbody.innerHTML = '<tr><td colspan="7" class="text-muted py-4">Cargando información...</td></tr>';

    try {
        const respuesta = await fetch(BASE_URL + '/api/bitacoras/historial');
        const datos = await respuesta.json();

        if (datos.exito) {
            todasLasBitacoras = datos.bitacoras;
            filtrarPlaneadores(); 
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-danger py-4">Error: ${datos.error}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger py-4">Error de conexión con el servidor.</td></tr>`;
    }
};

window.filtrarPlaneadores = function() {
    const textoBusqueda = document.getElementById('filtro-texto-planeador').value.toLowerCase();
    const estatusBusqueda = document.getElementById('filtro-estatus-planeador').value;
    const tbody = document.getElementById('tabla-planeadores-body');
    
    let htmlFilas = '';

    const bitacorasFiltradas = todasLasBitacoras.filter(b => {
        const coincideTexto = b.tecnico.toLowerCase().includes(textoBusqueda) || b.id_bitacora.toString().includes(textoBusqueda);
        const coincideEstatus = estatusBusqueda === 'TODOS' || b.estatus === estatusBusqueda;
        return coincideTexto && coincideEstatus;
    });

    if (bitacorasFiltradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted py-4">No se encontraron registros con esos filtros.</td></tr>';
        return;
    }

    bitacorasFiltradas.forEach(b => {
        const fecha = new Date(b.fecha_jornada).toLocaleDateString('es-MX');
        const kmRecorridos = (b.km_final && b.km_inicial) ? (b.km_final - b.km_inicial) + ' km' : 'En proceso';
        const efectivo = b.total_efectivo_entregado ? `$${parseFloat(b.total_efectivo_entregado).toFixed(2)}` : 'Pendiente';
        
        let badgeEstatus = '';
        if (b.estatus === 'En_Ruta') badgeEstatus = '<span class="badge bg-warning text-dark"> En Ruta</span>';
        else if (b.estatus === 'Cerrada_Ruta') badgeEstatus = '<span class="badge bg-danger"> Cerrada</span>';
        else if (b.estatus === 'Entregada') badgeEstatus = '<span class="badge bg-success"> Liquidada</span>';

        htmlFilas += `
            <tr>
                <td class="fw-bold">${b.id_bitacora}</td>
                <td>${fecha}</td>
                <td class="fw-bold text-primary">${b.tecnico}</td>
                <td>${kmRecorridos}</td>
                <td class="fw-bold text-success">${efectivo}</td>
                <td>${badgeEstatus}</td>
                <td>
                    <a href="planeadoractividadestecnico/imprimir_planeador.html?id=${b.id_bitacora}" class="btn btn-outline-primary btn-sm fw-bold">
                        🖨️ Ver Formato
                    </a>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlFilas;
};