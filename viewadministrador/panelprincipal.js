// Seguridad básica: Verificar que haya un usuario y que sea Admin
document.addEventListener('DOMContentLoaded', () => {
    const rolUsuario = localStorage.getItem('rolUsuario');
    if (rolUsuario !== 'Admin') {
        alert("Acceso denegado. Serás redirigido.");
        window.location.href = "../index.html"; // Regresa al login
        return;
    }

    // Cargar los datos iniciales de las 3 tablas
    cargarUsuarios();
    cargarClientes();
    cargarProductos(); 

    // Inicializar lienzos de firma digital
    configurarCanvasFirma('canvas-firma-nuevo', 'btn-limpiar-firma-nuevo');
    configurarCanvasFirma('canvas-firma-actualizar', 'btn-limpiar-firma-actualizar');
});

// Cerrar sesión
document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = "../index.html";
});

// ==========================================
// MÓDULO DE USUARIOS
// ==========================================
let listaUsuariosCache = [];

async function cargarUsuarios() {
    const tbody = document.getElementById('tabla-usuarios');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando usuarios...</td></tr>';

    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/usuarios');
        const datos = await respuesta.json();
        
        if (datos.exito) {
            listaUsuariosCache = datos.usuarios || [];
            renderizarUsuarios(listaUsuariosCache);
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-4">Error al cargar usuarios: ${datos.error || 'Desconocido'}</td></tr>`;
        }
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4">Error de conexión al cargar la lista de usuarios.</td></tr>';
    }
}

function renderizarUsuarios(usuarios) {
    const tbody = document.getElementById('tabla-usuarios');
    tbody.innerHTML = '';

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">No se encontraron usuarios.</td></tr>';
        return;
    }

    const idUsuarioActual = localStorage.getItem('idUsuario');

    usuarios.forEach(user => {
        let badgeRol = '<span class="badge bg-secondary">' + user.rol + '</span>';
        if (user.rol === 'Tecnico') badgeRol = '<span class="badge bg-primary">🔧 Técnico</span>';
        else if (user.rol === 'Mesa_Control') badgeRol = '<span class="badge bg-info text-dark">🖥️ Mesa de Control</span>';
        else if (user.rol === 'Direccion') badgeRol = '<span class="badge bg-warning text-dark">📊 Dirección</span>';
        else if (user.rol === 'Admin') badgeRol = '<span class="badge bg-dark">🛡️ Admin</span>';

        const esMismoUsuario = (user.id_usuario == idUsuarioActual);

        let botonEstatus = '';
        if (esMismoUsuario) {
            botonEstatus = `<span class="badge bg-light text-secondary border px-2 py-1" title="Esta es tu sesión activa">Tu cuenta</span>`;
        } else {
            botonEstatus = `
                <button class="btn btn-sm ${user.activo ? 'btn-outline-danger' : 'btn-outline-success'}" 
                    onclick="cambiarEstatusUsuario(${user.id_usuario}, ${!user.activo})">
                    ${user.activo ? 'Desactivar' : 'Reactivar'}
                </button>
            `;
        }

        const botonPassword = `
            <button class="btn btn-sm btn-outline-secondary ms-1" 
                onclick="abrirModalPassword(${user.id_usuario}, '${user.nombre_completo.replace(/'/g, "\\'")}')" 
                title="Cambiar contraseña de ${user.nombre_completo}">
                🔑
            </button>
        `;

        const badgeFirma = user.tiene_firma
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle">✍️ Registrada</span>'
            : '<span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">⚠️ Sin firma</span>';

        const botonFirma = `
            <button class="btn btn-sm btn-outline-success ms-1" 
                onclick="abrirModalFirma(${user.id_usuario}, '${user.nombre_completo.replace(/'/g, "\\'")}', '${user.firma_digital ? user.firma_digital.replace(/'/g, "\\'") : ''}')" 
                title="Registrar / Actualizar firma oficial de ${user.nombre_completo}">
                ✍️
            </button>
        `;

        const fila = `
            <tr>
                <td class="fw-semibold">${user.nombre_completo}</td>
                <td><code class="text-dark bg-light px-2 py-1 rounded">@${user.usuario}</code></td>
                <td>${badgeRol}</td>
                <td>${badgeFirma}</td>
                <td>
                    <span class="badge ${user.activo ? 'bg-success' : 'bg-danger'}">
                        ${user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                </td>
                <td class="text-end text-nowrap">
                    ${botonEstatus}
                    ${botonPassword}
                    ${botonFirma}
                </td>
            </tr>
        `;
        tbody.innerHTML += fila;
    });
}

// Filtro rápido de usuarios por texto
document.getElementById('filtro-usuarios')?.addEventListener('input', function() {
    const termino = this.value.toLowerCase().trim();
    if (!termino) {
        renderizarUsuarios(listaUsuariosCache);
        return;
    }

    const filtrados = listaUsuariosCache.filter(u => 
        (u.nombre_completo && u.nombre_completo.toLowerCase().includes(termino)) ||
        (u.usuario && u.usuario.toLowerCase().includes(termino)) ||
        (u.rol && u.rol.toLowerCase().includes(termino))
    );
    renderizarUsuarios(filtrados);
});

async function cambiarEstatusUsuario(id, nuevoEstatus) {
    const accionTexto = nuevoEstatus ? 'reactivar' : 'desactivar';
    if (!confirm(`¿Estás seguro de ${accionTexto} a este usuario?`)) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/usuarios/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstatus })
        });
        const datos = await respuesta.json();
        
        if (datos.exito) {
            cargarUsuarios(); // Recarga la tabla
        } else {
            alert("Error: " + (datos.error || "No se pudo cambiar el estatus"));
        }
    } catch (error) {
        console.error("Error al cambiar estatus:", error);
        alert("Error de conexión al intentar cambiar el estatus del usuario.");
    }
}

// ----------------------------------------------------
// Apertura y Guardado de Nuevo Usuario
// ----------------------------------------------------
document.getElementById('btn-nuevo-usuario')?.addEventListener('click', () => {
    const modalEl = document.getElementById('modalNuevoUsuario');
    if (!modalEl) return;

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    document.getElementById('form-nuevo-usuario').reset();
    limpiarCanvasFirma('canvas-firma-nuevo');

    const alertaError = document.getElementById('user-error-alert');
    if (alertaError) {
        alertaError.classList.add('d-none');
        alertaError.textContent = '';
    }

    modal.show();
});

// Envío del formulario de Nuevo Usuario
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const alertaError = document.getElementById('user-error-alert');
    alertaError.classList.add('d-none');
    alertaError.textContent = '';

    const nombre = document.getElementById('user-nombre').value.trim();
    const usuario = document.getElementById('user-username').value.trim();
    const rol = document.getElementById('user-rol').value;
    const password = document.getElementById('user-password').value;
    const passwordConfirm = document.getElementById('user-password-confirm').value;

    if (!nombre || !usuario || !rol || !password) {
        alertaError.textContent = 'Por favor completa todos los campos requeridos.';
        alertaError.classList.remove('d-none');
        return;
    }

    if (!['Tecnico', 'Mesa_Control'].includes(rol)) {
        alertaError.textContent = 'Solo se permite registrar usuarios con rol Técnico o Mesa de Control desde este panel.';
        alertaError.classList.remove('d-none');
        return;
    }

    if (usuario.length < 3) {
        alertaError.textContent = 'El nombre de usuario debe tener al menos 3 caracteres.';
        alertaError.classList.remove('d-none');
        return;
    }

    if (password.length < 4) {
        alertaError.textContent = 'La contraseña debe tener un mínimo de 4 caracteres.';
        alertaError.classList.remove('d-none');
        return;
    }

    if (password !== passwordConfirm) {
        alertaError.textContent = 'Las contraseñas no coinciden. Por favor verifícalas.';
        alertaError.classList.remove('d-none');
        return;
    }

    const canvasNuevo = document.getElementById('canvas-firma-nuevo');
    if (!canvasNuevo || canvasNuevo.getAttribute('data-firmada') !== 'true') {
        alertaError.textContent = 'Es obligatorio registrar la firma digital oficial del usuario.';
        alertaError.classList.remove('d-none');
        return;
    }

    const firmaDigital = canvasNuevo.toDataURL('image/png');

    const btnGuardar = document.getElementById('btn-guardar-usuario');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Guardando...';

    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre_completo: nombre,
                usuario: usuario,
                rol: rol,
                password: password,
                firma_digital: firmaDigital
            })
        });

        const datos = await respuesta.json();

        if (datos.exito) {
            const modalEl = document.getElementById('modalNuevoUsuario');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            cargarUsuarios();
            alert(`¡Usuario "${nombre}" registrado con éxito con su firma digital oficial!`);
        } else {
            alertaError.textContent = datos.error || 'Ocurrió un error al registrar el usuario.';
            alertaError.classList.remove('d-none');
        }
    } catch (error) {
        console.error("Error en la petición de registrar usuario:", error);
        alertaError.textContent = 'Error de conexión con el servidor. Revisa tu red o intenta más tarde.';
        alertaError.classList.remove('d-none');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
});

// ----------------------------------------------------
// Modal y Cambio de Contraseña de Usuario
// ----------------------------------------------------
window.abrirModalPassword = function(idUsuario, nombreCompleto) {
    const modalEl = document.getElementById('modalCambiarPassword');
    if (!modalEl) return;

    document.getElementById('form-cambiar-password').reset();
    document.getElementById('reset-id-usuario').value = idUsuario;
    document.getElementById('reset-nombre-usuario').value = nombreCompleto;

    const alertaError = document.getElementById('reset-error-alert');
    if (alertaError) {
        alertaError.classList.add('d-none');
        alertaError.textContent = '';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

document.getElementById('form-cambiar-password')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const alertaError = document.getElementById('reset-error-alert');
    alertaError.classList.add('d-none');
    alertaError.textContent = '';

    const idUsuario = document.getElementById('reset-id-usuario').value;
    const nuevaPassword = document.getElementById('reset-nueva-password').value;
    const confirmarPassword = document.getElementById('reset-confirmar-password').value;

    if (!nuevaPassword || nuevaPassword.length < 4) {
        alertaError.textContent = 'La nueva contraseña debe tener al menos 4 caracteres.';
        alertaError.classList.remove('d-none');
        return;
    }

    if (nuevaPassword !== confirmarPassword) {
        alertaError.textContent = 'Las contraseñas no coinciden.';
        alertaError.classList.remove('d-none');
        return;
    }

    const btnGuardar = document.getElementById('btn-guardar-password');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Actualizando...';

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/usuarios/${idUsuario}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: nuevaPassword })
        });

        const datos = await respuesta.json();

        if (datos.exito) {
            const modalEl = document.getElementById('modalCambiarPassword');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            alert('¡Contraseña actualizada con éxito!');
        } else {
            alertaError.textContent = datos.error || 'No se pudo actualizar la contraseña.';
            alertaError.classList.remove('d-none');
        }
    } catch (error) {
        console.error("Error al actualizar contraseña:", error);
        alertaError.textContent = 'Error de conexión con el servidor.';
        alertaError.classList.remove('d-none');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
});

// ----------------------------------------------------
// Modal y Actualización de Firma Oficial Digital
// ----------------------------------------------------
window.abrirModalFirma = function(idUsuario, nombreCompleto, firmaActual) {
    const modalEl = document.getElementById('modalActualizarFirma');
    if (!modalEl) return;

    document.getElementById('form-actualizar-firma').reset();
    document.getElementById('firma-id-usuario').value = idUsuario;
    document.getElementById('firma-nombre-usuario').value = nombreCompleto;

    limpiarCanvasFirma('canvas-firma-actualizar');

    const contPrevia = document.getElementById('contenedor-firma-previa');
    const imgPrevia = document.getElementById('img-firma-previa');
    if (firmaActual && firmaActual !== 'null' && firmaActual !== 'undefined' && firmaActual.length > 20) {
        imgPrevia.src = firmaActual;
        contPrevia.classList.remove('d-none');
    } else {
        contPrevia.classList.add('d-none');
        imgPrevia.src = '';
    }

    const alertaError = document.getElementById('firma-error-alert');
    if (alertaError) {
        alertaError.classList.add('d-none');
        alertaError.textContent = '';
    }

    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

document.getElementById('form-actualizar-firma')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const alertaError = document.getElementById('firma-error-alert');
    alertaError.classList.add('d-none');
    alertaError.textContent = '';

    const idUsuario = document.getElementById('firma-id-usuario').value;
    const canvas = document.getElementById('canvas-firma-actualizar');

    if (!canvas || canvas.getAttribute('data-firmada') !== 'true') {
        alertaError.textContent = 'Por favor dibuja la nueva firma oficial antes de guardar.';
        alertaError.classList.remove('d-none');
        return;
    }

    const firmaDigital = canvas.toDataURL('image/png');

    const btnGuardar = document.getElementById('btn-guardar-firma');
    const textoOriginal = btnGuardar.innerHTML;
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Guardando...';

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/usuarios/${idUsuario}/firma`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firma_digital: firmaDigital })
        });

        if (!respuesta.ok) {
            const errorTexto = await respuesta.text();
            let mensajeError = `Error en el servidor (${respuesta.status})`;
            try {
                const errorJson = JSON.parse(errorTexto);
                if (errorJson.error) mensajeError = errorJson.error;
            } catch (e) {
                if (respuesta.status === 404) {
                    mensajeError = 'El servidor aún no tiene cargada la nueva versión del backend (Error 404). Por favor haz "git pull" y reinicia el backend en el servidor.';
                }
            }
            alertaError.textContent = mensajeError;
            alertaError.classList.remove('d-none');
            return;
        }

        const datos = await respuesta.json();

        if (datos.exito) {
            const modalEl = document.getElementById('modalActualizarFirma');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            cargarUsuarios();
            alert('¡Firma oficial registrada y actualizada con éxito!');
        } else {
            alertaError.textContent = datos.error || 'Ocurrió un error al guardar la firma.';
            alertaError.classList.remove('d-none');
        }
    } catch (error) {
        console.error("Error al actualizar firma:", error);
        alertaError.textContent = 'Error de conexión con el servidor. Revisa tu red.';
        alertaError.classList.remove('d-none');
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
    }
});

// ----------------------------------------------------
// Utilidades de Canvas para Firma
// ----------------------------------------------------
function configurarCanvasFirma(idCanvas, idBotonLimpiar) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    let dibujando = false;

    const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    };

    const iniciar = (e) => {
        e.preventDefault();
        dibujando = true;
        canvas.setAttribute('data-firmada', 'true');
        const p = getPos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
    };

    const dibujar = (e) => {
        e.preventDefault();
        if (!dibujando) return;
        const p = getPos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };

    const detener = () => {
        dibujando = false;
        ctx.closePath();
    };

    canvas.addEventListener('mousedown', iniciar);
    canvas.addEventListener('mousemove', dibujar);
    canvas.addEventListener('mouseup', detener);
    canvas.addEventListener('mouseleave', detener);

    canvas.addEventListener('touchstart', iniciar, { passive: false });
    canvas.addEventListener('touchmove', dibujar, { passive: false });
    canvas.addEventListener('touchend', detener);

    const btnLimpiar = document.getElementById(idBotonLimpiar);
    if (btnLimpiar) {
        btnLimpiar.addEventListener('click', (e) => {
            e.preventDefault();
            limpiarCanvasFirma(idCanvas);
        });
    }
}

function limpiarCanvasFirma(idCanvas) {
    const canvas = document.getElementById(idCanvas);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.setAttribute('data-firmada', 'false');
}

// ==========================================
// MÓDULO DE CLIENTES 
// ==========================================
async function cargarClientes() {
    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/clientes');
        const datos = await respuesta.json();
        
        const tbody = document.getElementById('tabla-clientes');
        tbody.innerHTML = ''; 

        if(datos.exito) {
            datos.clientes.forEach(cliente => {
                const fila = `
                    <tr>
                        <td>${cliente.nombre}</td>
                        <td>${cliente.clase || 'N/A'}</td>
                        <td>
                            <span class="badge ${cliente.activo ? 'bg-success' : 'bg-danger'}">
                                ${cliente.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm ${cliente.activo ? 'btn-danger' : 'btn-success'}" 
                                onclick="cambiarEstatusCliente(${cliente.id_cliente}, ${!cliente.activo})">
                                ${cliente.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar clientes:", error);
    }
}

async function cambiarEstatusCliente(id, nuevoEstatus) {
    if(!confirm(`¿Estás seguro de cambiar el estatus de este cliente?`)) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/clientes/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstatus })
        });
        const datos = await respuesta.json();
        
        if(datos.exito) {
            cargarClientes(); // Recarga la tabla
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        console.error("Error al cambiar estatus del cliente:", error);
    }
}

// ==========================================
// MÓDULO DE PRODUCTOS (Químicos)
// ==========================================
async function cargarProductos() {
    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/productos');
        const datos = await respuesta.json();
        
        const tbody = document.getElementById('tabla-productos');
        tbody.innerHTML = ''; 

        if(datos.exito) {
            datos.productos.forEach(producto => {
                const tipoTexto = producto.tipo_quimico || (producto.categoria === 'Quimico' ? 'Químico' : (producto.categoria || 'N/A'));
                const fila = `
                    <tr>
                        <td><strong>${producto.nombre_comercial}</strong><br><small class="text-muted">${producto.clave_producto}</small></td>
                        <td><span class="badge bg-light text-dark border">${tipoTexto}</span></td>
                        <td>${producto.ingrediente_activo || 'N/A'}</td>
                        <td>
                            <span class="badge ${producto.activo ? 'bg-success' : 'bg-danger'}">
                                ${producto.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm ${producto.activo ? 'btn-danger' : 'btn-success'}" 
                                onclick="cambiarEstatusProducto(${producto.id_producto}, ${!producto.activo})">
                                ${producto.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar productos:", error);
    }
}

async function cambiarEstatusProducto(id, nuevoEstatus) {
    if(!confirm(`¿Estás seguro de cambiar el estatus de este producto?`)) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/productos/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstatus })
        });
        const datos = await respuesta.json();
        
        if(datos.exito) {
            cargarProductos(); // Recarga la tabla
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        console.error("Error al cambiar estatus del producto:", error);
    }
}

// ==========================================
// INTERFAZ: MODAL DE NUEVO PRODUCTO
// ==========================================

// Mostrar la ventana al hacer clic en el botón
document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    const modal = new bootstrap.Modal(document.getElementById('modalNuevoProducto'));
    document.getElementById('form-nuevo-producto').reset(); // Limpia el formulario
    document.getElementById('seccion-quimicos').classList.add('d-none'); // Oculta sección química por defecto
    const inputOtro = document.getElementById('prod-tipo-quimico-otro');
    if (inputOtro) {
        inputOtro.classList.add('d-none');
        inputOtro.required = false;
        inputOtro.value = '';
    }
    modal.show();
});

// Mostrar campos químicos solo si se elige "Quimico"
document.getElementById('prod-categoria').addEventListener('change', function() {
    const seccionQuimicos = document.getElementById('seccion-quimicos');
    
    if (this.value === 'Quimico') {
        seccionQuimicos.classList.remove('d-none'); // Muestra el cuadro gris
    } else {
        seccionQuimicos.classList.add('d-none'); // Lo oculta
        // Limpiamos los campos por si el usuario se equivocó y los había llenado
        document.getElementById('prod-tipo-quimico').value = '';
        const inputOtro = document.getElementById('prod-tipo-quimico-otro');
        if (inputOtro) {
            inputOtro.value = '';
            inputOtro.classList.add('d-none');
            inputOtro.required = false;
        }
        document.getElementById('prod-subcategoria').value = '';
        document.getElementById('prod-ingrediente').value = '';
        document.getElementById('prod-registro').value = '';
    }
});

// Toggle input libre cuando se selecciona 'Otro' en tipo de químico
const selTipoQuimico = document.getElementById('prod-tipo-quimico');
if (selTipoQuimico) {
    selTipoQuimico.addEventListener('change', function() {
        const inputOtro = document.getElementById('prod-tipo-quimico-otro');
        if (!inputOtro) return;
        if (this.value === 'Otro') {
            inputOtro.classList.remove('d-none');
            inputOtro.required = true;
            inputOtro.focus();
        } else {
            inputOtro.classList.add('d-none');
            inputOtro.required = false;
            inputOtro.value = '';
        }
    });
}

// Guardar el nuevo producto en la base de datos
document.getElementById('form-nuevo-producto').addEventListener('submit', async function(e) {
    e.preventDefault(); // Evita que la página se recargue

    let tipoQuimico = null;
    if (document.getElementById('prod-categoria').value === 'Quimico') {
        const valTipo = document.getElementById('prod-tipo-quimico').value;
        if (valTipo === 'Otro') {
            tipoQuimico = (document.getElementById('prod-tipo-quimico-otro').value || '').trim() || 'Otro';
        } else {
            tipoQuimico = valTipo || null;
        }
    }

    // Recopilamos los datos del formulario
    const nuevoProducto = {
        nombre_comercial: document.getElementById('prod-nombre').value,
        clave_producto: document.getElementById('prod-clave').value,
        categoria: document.getElementById('prod-categoria').value,
        unidad_medida: document.getElementById('prod-unidad').value,
        capacidad_presentacion: document.getElementById('prod-presentacion').value,
        stock_minimo: document.getElementById('prod-stock-min').value,
        
        // Estos campos solo tendrán valor si es Químico, si no, se enviarán vacíos
        tipo_quimico: tipoQuimico,
        subcategoria: document.getElementById('prod-subcategoria').value || null,
        ingrediente_activo: document.getElementById('prod-ingrediente').value || null,
        registro_sanitario: document.getElementById('prod-registro').value || null
    };

    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/productos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoProducto)
        });

        const datos = await respuesta.json();

        if (datos.exito) {
            // Cerramos la ventana modal usando bootstrap
            const modalEl = document.getElementById('modalNuevoProducto');
            const modal = bootstrap.Modal.getInstance(modalEl);
            modal.hide();
            
            // Recargamos la tabla para que aparezca el nuevo registro
            cargarProductos();
            alert("¡Producto registrado con éxito!");
        } else {
            alert("Error al registrar: " + datos.error);
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        alert("Hubo un problema de conexión al guardar el producto.");
    }
});

// =====================================================================
// HISTORIAL Y AUDITORÍA DE INVENTARIO (ADMINISTRADOR)
// =====================================================================

window.cargarHistorialInventario = async function(forzarFechas = false) {
    const tbody = document.getElementById('tabla-historial-inventario');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Consultando a la base de datos...</td></tr>';

    try {
        let url = BASE_URL + '/api/inventario/historial';
        
        // Si se activó la búsqueda por fechas, agregamos los datos a la URL
        if (forzarFechas) {
            const fechaInicio = document.getElementById('filtro-fecha-inicio').value;
            const fechaFin = document.getElementById('filtro-fecha-fin').value;
            
            if (!fechaInicio || !fechaFin) {
                alert("Por favor, selecciona tanto la fecha de inicio como la fecha fin.");
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Esperando selección de fechas...</td></tr>';
                return;
            }
            url += `?fechaInicio=${fechaInicio}&fechaFin=${fechaFin}`;
        }

        const respuesta = await fetch(url);
        const datos = await respuesta.json();

        if (datos.exito) {
            if (datos.historial.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron movimientos en ese periodo.</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            
            datos.historial.forEach(mov => {
                const fecha = new Date(mov.fecha_movimiento).toLocaleString('es-MX', { 
                    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                });

                let colorBadge = 'bg-secondary';
                if (mov.tipo_movimiento === 'Entrada por Compra') colorBadge = 'bg-success';
                if (mov.tipo_movimiento === 'Traspaso a Técnico') colorBadge = 'bg-primary';
                if (mov.tipo_movimiento === 'Consumo') colorBadge = 'bg-warning text-dark';

                const fila = `
                    <tr class="fila-historial" data-tipo="${mov.tipo_movimiento}">
                        <td class="text-muted small">${fecha}</td>
                        <td class="fw-bold text-dark">${mov.nombre_comercial}</td>
                        <td><span class="badge ${colorBadge}">${mov.tipo_movimiento}</span></td>
                        <td class="fw-bold">${parseFloat(mov.cantidad).toFixed(2)} ${mov.unidad_medida}</td>
                        <td class="small">
                            <span class="text-danger">${mov.origen}</span> ➡️ <span class="text-success">${mov.destino}</span>
                        </td>
                        <td class="text-secondary small">👤 ${mov.usuario_registra}</td>
                        <td class="text-muted small fst-italic">${mov.notas || '-'}</td>
                    </tr>
                `;
                tbody.innerHTML += fila;
            });
            
            // Volvemos a aplicar los filtros rápidos de texto por si quedaron escritos
            aplicarFiltrosHistorial();
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error: ${datos.error}</td></tr>`;
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error de conexión al cargar historial.</td></tr>`;
    }
};

// Eventos de los botones de fechas
document.getElementById('btn-buscar-fechas')?.addEventListener('click', () => {
    cargarHistorialInventario(true); // Ejecuta forzando la lectura de fechas
});

document.getElementById('btn-limpiar-fechas')?.addEventListener('click', () => {
    document.getElementById('filtro-fecha-inicio').value = '';
    document.getElementById('filtro-fecha-fin').value = '';
    document.getElementById('filtro-texto-historial').value = '';
    document.getElementById('filtro-tipo-historial').value = 'todos';
    cargarHistorialInventario(false); // Vuelve a cargar los últimos 200 por defecto
});

// Disparador: Cargar historial al abrir la pestaña correspondiente
document.getElementById('historial-tab')?.addEventListener('shown.bs.tab', function () {
    cargarHistorialInventario();
});

// =====================================================================
// FILTROS EN TIEMPO REAL PARA EL HISTORIAL
// =====================================================================

function aplicarFiltrosHistorial() {
    const textoBuscar = document.getElementById('filtro-texto-historial').value.toLowerCase();
    const tipoBuscar = document.getElementById('filtro-tipo-historial').value;
    
    // Tomamos todas las filas que creamos
    const filas = document.querySelectorAll('.fila-historial');

    filas.forEach(fila => {
        const textoFila = fila.innerText.toLowerCase(); // Todo el texto visible de la fila
        const tipoFila = fila.getAttribute('data-tipo'); // El tipo de movimiento oculto en la fila

        // Verificamos si cumple ambas condiciones
        const coincideTexto = textoFila.includes(textoBuscar);
        const coincideTipo = (tipoBuscar === 'todos' || tipoFila === tipoBuscar);

        if (coincideTexto && coincideTipo) {
            fila.style.display = ''; // Lo mostramos
        } else {
            fila.style.display = 'none'; // Lo ocultamos
        }
    });
}

// Escuchamos cuando el usuario escriba o cambie el selector
document.getElementById('filtro-texto-historial')?.addEventListener('input', aplicarFiltrosHistorial);
document.getElementById('filtro-tipo-historial')?.addEventListener('change', aplicarFiltrosHistorial);