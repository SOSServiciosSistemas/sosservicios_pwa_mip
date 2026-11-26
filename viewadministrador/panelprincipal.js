// Seguridad robusta: Verificar autenticidad de sesión y rol Admin contra el servidor
document.addEventListener('DOMContentLoaded', async () => {
    const tieneAcceso = await window.validarAccesoVista(['Admin', 'Administrador']);
    if (!tieneAcceso) return;

    // Cargar los datos iniciales de las 3 tablas
    cargarUsuarios();
    cargarClientes();
    cargarProductos();

    // Inicializar pizarra de firma digital a pantalla completa
    inicializarPizarraFirmaPantallaCompleta();
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
document.getElementById('filtro-usuarios')?.addEventListener('input', function () {
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
    limpiarFirmaCapturada('nuevo');

    const alertaError = document.getElementById('user-error-alert');
    if (alertaError) {
        alertaError.classList.add('d-none');
        alertaError.textContent = '';
    }

    modal.show();
});

// Envío del formulario de Nuevo Usuario
document.getElementById('form-nuevo-usuario')?.addEventListener('submit', async function (e) {
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

    const firmaDigital = document.getElementById('firma-nuevo-base64')?.value || '';
    if (!firmaDigital) {
        alertaError.textContent = 'Es obligatorio registrar la firma digital oficial del usuario.';
        alertaError.classList.remove('d-none');
        return;
    }

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
window.abrirModalPassword = function (idUsuario, nombreCompleto) {
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

document.getElementById('form-cambiar-password')?.addEventListener('submit', async function (e) {
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
window.abrirModalFirma = function (idUsuario, nombreCompleto, firmaActual) {
    const modalEl = document.getElementById('modalActualizarFirma');
    if (!modalEl) return;

    document.getElementById('form-actualizar-firma').reset();
    document.getElementById('firma-id-usuario').value = idUsuario;
    document.getElementById('firma-nombre-usuario').value = nombreCompleto;

    limpiarFirmaCapturada('actualizar');

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

document.getElementById('form-actualizar-firma')?.addEventListener('submit', async function (e) {
    e.preventDefault();

    const alertaError = document.getElementById('firma-error-alert');
    alertaError.classList.add('d-none');
    alertaError.textContent = '';

    const idUsuario = document.getElementById('firma-id-usuario').value;
    const firmaDigital = document.getElementById('firma-actualizar-base64')?.value || '';

    if (!firmaDigital) {
        alertaError.textContent = 'Por favor dibuja la nueva firma oficial antes de guardar.';
        alertaError.classList.remove('d-none');
        return;
    }

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
// Pizarra de Firma a Pantalla Completa y Recorte Automático
// ----------------------------------------------------
const FIRMA_MODOS = {
    nuevo: {
        inputId: 'firma-nuevo-base64',
        previewContId: 'contenedor-preview-firma-nuevo',
        previewImgId: 'preview-firma-nuevo',
        btnAbrirId: 'btn-abrir-firma-nuevo',
        btnLimpiarId: 'btn-limpiar-firma-nuevo',
        textoInicial: 'Firmar en Pantalla Completa'
    },
    actualizar: {
        inputId: 'firma-actualizar-base64',
        previewContId: 'contenedor-preview-firma-actualizar',
        previewImgId: 'preview-firma-actualizar',
        btnAbrirId: 'btn-abrir-firma-actualizar',
        btnLimpiarId: 'btn-limpiar-firma-actualizar',
        textoInicial: 'Dibujar Nueva Firma en Pantalla Completa'
    }
};

let signaturePadAdmin = null;
let modoFirmaActivo = null;

function inicializarPizarraFirmaPantallaCompleta() {
    const pizarra = document.getElementById('pizarra-firma-usuario');
    const modalPizarra = document.getElementById('modal-firma-pantalla-completa');
    const btnCerrar = document.getElementById('btn-cerrar-pizarra-firma');
    const btnBorrar = document.getElementById('btn-borrar-pizarra-firma');
    const btnAplicar = document.getElementById('btn-aplicar-pizarra-firma');

    if (pizarra && typeof SignaturePad !== 'undefined') {
        signaturePadAdmin = new SignaturePad(pizarra, {
            backgroundColor: 'rgb(255, 255, 255)',
            minWidth: 4,
            maxWidth: 8
        });
    }

    Object.entries(FIRMA_MODOS).forEach(([modo, cfg]) => {
        document.getElementById(cfg.btnAbrirId)?.addEventListener('click', () => {
            abrirPizarraFirmaPantallaCompleta(modo);
        });
        document.getElementById(cfg.btnLimpiarId)?.addEventListener('click', (e) => {
            e.preventDefault();
            limpiarFirmaCapturada(modo);
        });
    });

    const cerrarPizarra = () => {
        if (modalPizarra) modalPizarra.classList.add('d-none');
        modoFirmaActivo = null;
    };

    btnCerrar?.addEventListener('click', cerrarPizarra);

    btnBorrar?.addEventListener('click', () => {
        if (signaturePadAdmin) signaturePadAdmin.clear();
    });

    btnAplicar?.addEventListener('click', () => {
        if (!signaturePadAdmin || signaturePadAdmin.isEmpty()) {
            alert('Por favor dibuja la firma en el recuadro antes de aplicar.');
            return;
        }
        const imagenRecortada = recortarYRedimensionarFirma(pizarra);
        if (modoFirmaActivo) {
            establecerFirmaCapturada(modoFirmaActivo, imagenRecortada);
        }
        cerrarPizarra();
    });

    window.addEventListener('resize', () => {
        if (modalPizarra && !modalPizarra.classList.contains('d-none')) {
            redimensionarPizarraUsuario();
        }
    });
}

function abrirPizarraFirmaPantallaCompleta(modo) {
    const modalPizarra = document.getElementById('modal-firma-pantalla-completa');
    if (!modalPizarra) return;
    modoFirmaActivo = modo;
    modalPizarra.classList.remove('d-none');
    setTimeout(redimensionarPizarraUsuario, 100);
}

function redimensionarPizarraUsuario() {
    const canvas = document.getElementById('pizarra-firma-usuario');
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    if (signaturePadAdmin) signaturePadAdmin.clear();
}

// Recorta márgenes en blanco y ajusta el tamaño para que luzca nítida y proporcional en reportes
function recortarYRedimensionarFirma(canvasSrc) {
    const ctx = canvasSrc.getContext('2d');
    const w = canvasSrc.width;
    const h = canvasSrc.height;
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let pixelEncontrado = false;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            const a = data[idx + 3];

            if (a > 20 && (r < 240 || g < 240 || b < 240)) {
                pixelEncontrado = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }

    if (!pixelEncontrado) {
        return canvasSrc.toDataURL('image/png');
    }

    const padding = Math.max(15, Math.round(w * 0.02));
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w, maxX + padding);
    maxY = Math.min(h, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    // Escalar proporcionalmente a un tamaño óptimo para reportes (alta nitidez sin peso excesivo)
    const escala = Math.min(1, 600 / cropW, 220 / cropH);
    const outW = Math.max(1, Math.round(cropW * escala));
    const outH = Math.max(1, Math.round(cropH * escala));

    const cropped = document.createElement('canvas');
    cropped.width = outW;
    cropped.height = outH;
    const cCtx = cropped.getContext('2d');

    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 0, outW, outH);

    cCtx.drawImage(
        canvasSrc,
        minX, minY, cropW, cropH,
        0, 0, outW, outH
    );

    return cropped.toDataURL('image/png');
}

function establecerFirmaCapturada(modo, dataUrl) {
    const cfg = FIRMA_MODOS[modo];
    if (!cfg) return;

    const input = document.getElementById(cfg.inputId);
    const cont = document.getElementById(cfg.previewContId);
    const img = document.getElementById(cfg.previewImgId);
    const btnAbrir = document.getElementById(cfg.btnAbrirId);
    const btnLimpiar = document.getElementById(cfg.btnLimpiarId);

    if (input) input.value = dataUrl;
    if (img) img.src = dataUrl;
    if (cont) cont.classList.remove('d-none');
    if (btnLimpiar) btnLimpiar.classList.remove('d-none');
    if (btnAbrir) {
        btnAbrir.classList.remove('btn-success');
        btnAbrir.classList.add('btn-outline-success');
        btnAbrir.innerHTML = `<i class="fas fa-pen me-2"></i> Cambiar / Volver a Firmar`;
    }
}

function limpiarFirmaCapturada(modo) {
    const cfg = FIRMA_MODOS[modo];
    if (!cfg) return;

    const input = document.getElementById(cfg.inputId);
    const cont = document.getElementById(cfg.previewContId);
    const img = document.getElementById(cfg.previewImgId);
    const btnAbrir = document.getElementById(cfg.btnAbrirId);
    const btnLimpiar = document.getElementById(cfg.btnLimpiarId);

    if (input) input.value = '';
    if (img) img.src = '';
    if (cont) cont.classList.add('d-none');
    if (btnLimpiar) btnLimpiar.classList.add('d-none');
    if (btnAbrir) {
        btnAbrir.classList.remove('btn-outline-success');
        btnAbrir.classList.add('btn-success');
        btnAbrir.innerHTML = `<i class="fas fa-pen me-2"></i> ${cfg.textoInicial}`;
    }
}

// ==========================================
// MÓDULO DE CLIENTES 
// ==========================================
async function cargarClientes() {
    const tbody = document.getElementById('tabla-clientes');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando clientes...</td></tr>';

    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/clientes');
        const datos = await respuesta.json();

        if (!tbody) return;
        tbody.innerHTML = '';

        if (datos.exito && Array.isArray(datos.clientes)) {
            if (datos.clientes.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">No hay clientes registrados en el sistema.</td></tr>';
                return;
            }

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
        } else {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">Error al cargar clientes: ${datos.error || 'Respuesta inválida'}</td></tr>`;
        }
    } catch (error) {
        console.error("Error al cargar clientes:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger py-4">Error de conexión al cargar clientes.</td></tr>';
    }
}

async function cambiarEstatusCliente(id, nuevoEstatus) {
    if (!confirm(`¿Estás seguro de cambiar el estatus de este cliente?`)) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/clientes/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstatus })
        });
        const datos = await respuesta.json();

        if (datos.exito) {
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
let listaProductosActuales = [];

async function cargarProductos() {
    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/productos');
        const datos = await respuesta.json();

        const tbody = document.getElementById('tabla-productos');
        tbody.innerHTML = '';

        if (datos.exito) {
            listaProductosActuales = datos.productos || [];
            listaProductosActuales.forEach(producto => {
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
                            <div class="d-flex gap-1 justify-content-start">
                                <button class="btn btn-sm btn-outline-primary" 
                                    onclick="abrirModalEditarProducto(${producto.id_producto})" title="Modificar Producto">
                                    ✏️ Editar
                                </button>
                                <button class="btn btn-sm ${producto.activo ? 'btn-danger' : 'btn-success'}" 
                                    onclick="cambiarEstatusProducto(${producto.id_producto}, ${!producto.activo})">
                                    ${producto.activo ? 'Desactivar' : 'Reactivar'}
                                </button>
                            </div>
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
    if (!confirm(`¿Estás seguro de cambiar el estatus de este producto?`)) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/productos/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstatus })
        });
        const datos = await respuesta.json();

        if (datos.exito) {
            cargarProductos(); // Recarga la tabla
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        console.error("Error al cambiar estatus del producto:", error);
    }
}

// Abrir modal en modo edición
window.abrirModalEditarProducto = function (id) {
    const prod = listaProductosActuales.find(p => p.id_producto === id);
    if (!prod) {
        alert("No se encontró la información del producto.");
        return;
    }

    const form = document.getElementById('form-nuevo-producto');
    form.reset();

    document.getElementById('prod-id-edicion').value = prod.id_producto;
    document.getElementById('modalNuevoProductoLabel').textContent = `Modificar Producto: ${prod.nombre_comercial}`;
    document.getElementById('btn-guardar-producto').textContent = 'Actualizar Cambios';

    document.getElementById('prod-nombre').value = prod.nombre_comercial || '';
    document.getElementById('prod-clave').value = prod.clave_producto || '';
    document.getElementById('prod-categoria').value = prod.categoria || '';
    document.getElementById('prod-unidad').value = prod.unidad_medida || 'ml';
    document.getElementById('prod-presentacion').value = prod.capacidad_presentacion || '';
    document.getElementById('prod-stock-min').value = prod.stock_minimo || '';

    const seccionQuimicos = document.getElementById('seccion-quimicos');
    const selTipo = document.getElementById('prod-tipo-quimico');
    const selSub = document.getElementById('prod-subcategoria');
    const inputOtro = document.getElementById('prod-tipo-quimico-otro');

    if (prod.categoria === 'Quimico') {
        seccionQuimicos.classList.remove('d-none');
        if (selTipo) selTipo.required = true;
        if (selSub) selSub.required = true;

        const tiposEstandar = ['Plaguicida', 'Rodenticida', 'Sanitizante', 'Desinfectante'];
        if (tiposEstandar.includes(prod.tipo_quimico)) {
            selTipo.value = prod.tipo_quimico;
            window.toggleCampoTipoQuimico(prod.tipo_quimico);
        } else if (prod.tipo_quimico) {
            selTipo.value = 'Otro';
            window.toggleCampoTipoQuimico('Otro');
            if (inputOtro) inputOtro.value = prod.tipo_quimico;
        } else {
            selTipo.value = '';
            window.toggleCampoTipoQuimico('');
        }

        if (selSub) selSub.value = prod.subcategoria || '';
        document.getElementById('prod-ingrediente').value = prod.ingrediente_activo || '';
        document.getElementById('prod-registro').value = prod.registro_sanitario || '';
    } else {
        seccionQuimicos.classList.add('d-none');
        if (selTipo) { selTipo.required = false; selTipo.value = ''; }
        if (selSub) { selSub.required = false; selSub.value = ''; }
        if (inputOtro) { inputOtro.required = false; inputOtro.value = ''; inputOtro.classList.add('d-none'); }
        document.getElementById('prod-ingrediente').value = '';
        document.getElementById('prod-registro').value = '';
    }

    const modalEl = document.getElementById('modalNuevoProducto');
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
};

// ==========================================
// INTERFAZ: MODAL DE NUEVO PRODUCTO
// ==========================================

// Mostrar la ventana al hacer clic en el botón
document.getElementById('btn-nuevo-producto').addEventListener('click', () => {
    document.getElementById('prod-id-edicion').value = '';
    document.getElementById('modalNuevoProductoLabel').textContent = 'Registrar Nuevo Producto al Catálogo';
    document.getElementById('btn-guardar-producto').textContent = 'Guardar Producto';

    const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('modalNuevoProducto'));
    document.getElementById('form-nuevo-producto').reset(); // Limpia el formulario
    document.getElementById('seccion-quimicos').classList.add('d-none'); // Oculta sección química por defecto

    const selTipo = document.getElementById('prod-tipo-quimico');
    const selSub = document.getElementById('prod-subcategoria');
    const inputOtro = document.getElementById('prod-tipo-quimico-otro');

    if (selTipo) { selTipo.required = false; selTipo.value = ''; }
    if (selSub) { selSub.required = false; selSub.value = ''; }
    if (inputOtro) {
        inputOtro.classList.add('d-none');
        inputOtro.required = false;
        inputOtro.value = '';
    }
    modal.show();
});

// Mostrar campos químicos solo si se elige "Quimico"
document.getElementById('prod-categoria').addEventListener('change', function () {
    const seccionQuimicos = document.getElementById('seccion-quimicos');
    const selTipo = document.getElementById('prod-tipo-quimico');
    const selSub = document.getElementById('prod-subcategoria');
    const inputOtro = document.getElementById('prod-tipo-quimico-otro');

    if (this.value === 'Quimico') {
        seccionQuimicos.classList.remove('d-none'); // Muestra el cuadro gris
        if (selTipo) selTipo.required = true;
        if (selSub) selSub.required = true;
    } else {
        seccionQuimicos.classList.add('d-none'); // Lo oculta
        // Limpiamos los campos por si el usuario se equivocó y los había llenado
        if (selTipo) { selTipo.required = false; selTipo.value = ''; }
        if (selSub) { selSub.required = false; selSub.value = ''; }
        if (inputOtro) {
            inputOtro.value = '';
            inputOtro.classList.add('d-none');
            inputOtro.required = false;
        }
        document.getElementById('prod-ingrediente').value = '';
        document.getElementById('prod-registro').value = '';
    }
});

// Función global para alternar input libre de tipo químico
window.toggleCampoTipoQuimico = function (val) {
    const inputOtro = document.getElementById('prod-tipo-quimico-otro');
    if (!inputOtro) return;
    if (val === 'Otro') {
        inputOtro.classList.remove('d-none');
        inputOtro.required = true;
        inputOtro.focus();
    } else {
        inputOtro.classList.add('d-none');
        inputOtro.required = false;
        inputOtro.value = '';
    }
};

// Toggle input libre cuando se selecciona 'Otro' en tipo de químico
const selTipoQuimico = document.getElementById('prod-tipo-quimico');
if (selTipoQuimico) {
    selTipoQuimico.addEventListener('change', function () {
        window.toggleCampoTipoQuimico(this.value);
    });
}

// Guardar el nuevo producto en la base de datos
document.getElementById('form-nuevo-producto').addEventListener('submit', async function (e) {
    e.preventDefault(); // Evita que la página se recargue

    const categoria = document.getElementById('prod-categoria').value;
    let tipoQuimico = null;
    let subcategoria = null;

    if (categoria === 'Quimico') {
        const selTipo = document.getElementById('prod-tipo-quimico');
        const valTipo = selTipo ? selTipo.value : '';
        if (!valTipo) {
            alert("Por favor, selecciona el Tipo de Químico (Plaguicida, Rodenticida, etc.).");
            if (selTipo) selTipo.focus();
            return;
        }

        if (valTipo === 'Otro') {
            const inputOtro = document.getElementById('prod-tipo-quimico-otro');
            tipoQuimico = (inputOtro ? inputOtro.value : '').trim();
            if (!tipoQuimico) {
                alert("Por favor, especifica cuál es el tipo de químico en el campo de texto.");
                if (inputOtro) inputOtro.focus();
                return;
            }
        } else {
            tipoQuimico = valTipo;
        }

        const selSubcat = document.getElementById('prod-subcategoria');
        subcategoria = selSubcat ? selSubcat.value : '';
        if (!subcategoria) {
            alert("Por favor, selecciona la Subcategoría (Banda toxicológica) del producto químico.");
            if (selSubcat) selSubcat.focus();
            return;
        }
    }

    // Recopilamos los datos del formulario
    const nuevoProducto = {
        nombre_comercial: document.getElementById('prod-nombre').value,
        clave_producto: document.getElementById('prod-clave').value,
        categoria: categoria,
        unidad_medida: document.getElementById('prod-unidad').value,
        capacidad_presentacion: document.getElementById('prod-presentacion').value,
        stock_minimo: document.getElementById('prod-stock-min').value,

        // Estos campos solo tendrán valor si es Químico, si no, se enviarán vacíos
        tipo_quimico: tipoQuimico,
        subcategoria: subcategoria || null,
        ingrediente_activo: document.getElementById('prod-ingrediente').value || null,
        registro_sanitario: document.getElementById('prod-registro').value || null
    };

    try {
        const idEdicion = document.getElementById('prod-id-edicion').value;
        const esEdicion = Boolean(idEdicion);
        const urlPeticion = esEdicion ? `${BASE_URL}/api/admin/productos/${idEdicion}` : `${BASE_URL}/api/admin/productos`;
        const metodoPeticion = esEdicion ? 'PUT' : 'POST';

        const respuesta = await fetch(urlPeticion, {
            method: metodoPeticion,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevoProducto)
        });

        const datos = await respuesta.json();

        if (datos.exito) {
            // Cerramos la ventana modal usando bootstrap
            const modalEl = document.getElementById('modalNuevoProducto');
            const modal = bootstrap.Modal.getInstance(modalEl);
            if (modal) modal.hide();

            // Recargamos la tabla para que aparezca el nuevo registro o los cambios
            cargarProductos();
            alert(esEdicion ? "¡Producto modificado con éxito!" : "¡Producto registrado con éxito!");
        } else {
            alert("Error al guardar: " + datos.error);
        }
    } catch (error) {
        console.error("Error en la petición:", error);
        alert("Hubo un problema de conexión al guardar el producto.");
    }
});

// =====================================================================
// HISTORIAL Y AUDITORÍA DE INVENTARIO (ADMINISTRADOR)
// =====================================================================

window.cargarHistorialInventario = async function (forzarFechas = false) {
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

// =====================================================================
// CONTROL DE RUTAS Y REAPERTURA DE PLANEADORES (ADMINISTRADOR)
// =====================================================================
let listaRutasAdminCache = [];

async function cargarRutasAdmin() {
    const tbody = document.getElementById('tabla-rutas-admin');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><span class="spinner-border spinner-border-sm me-2"></span>Cargando rutas y planeadores...</td></tr>';

    try {
        const respuesta = await fetch(BASE_URL + '/api/bitacoras/historial');
        const datos = await respuesta.json();

        if (datos.exito) {
            listaRutasAdminCache = datos.bitacoras || [];
            filtrarRutasAdmin();
        } else {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar rutas: ${datos.error || 'Desconocido'}</td></tr>`;
        }
    } catch (error) {
        console.error("Error al cargar rutas:", error);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">Error de conexión con el servidor.</td></tr>';
    }
}

function filtrarRutasAdmin() {
    const texto = (document.getElementById('filtro-texto-rutas')?.value || '').toLowerCase();
    const estatus = document.getElementById('filtro-estatus-rutas')?.value || 'TODOS';
    const tbody = document.getElementById('tabla-rutas-admin');
    if (!tbody) return;

    const filtradas = listaRutasAdminCache.filter(b => {
        const coincideTexto = (b.tecnico || '').toLowerCase().includes(texto) || String(b.id_bitacora).includes(texto);
        const coincideEstatus = (estatus === 'TODOS') || b.estatus === estatus;
        return coincideTexto && coincideEstatus;
    });

    if (filtradas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No se encontraron rutas con los filtros aplicados.</td></tr>';
        return;
    }

    let html = '';
    filtradas.forEach(b => {
        // Formatear fecha en horario local de México
        const fechaDate = new Date(b.fecha_jornada);
        const fechaAjustada = new Date(fechaDate.getTime() + (fechaDate.getTimezoneOffset() * 60000));
        const fechaTxt = fechaAjustada.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

        let kmTexto = '<span class="text-muted">Sin datos</span>';
        if (b.km_inicial !== null && b.km_inicial !== undefined) {
            if (b.km_final !== null && b.km_final !== undefined) {
                const diff = (parseFloat(b.km_final) - parseFloat(b.km_inicial)).toFixed(1);
                kmTexto = `${b.km_inicial} ➔ ${b.km_final} <br><small class="text-primary fw-bold">(${diff} km)</small>`;
            } else {
                kmTexto = `<span class="badge bg-light text-dark border">Inicio: ${b.km_inicial} km</span>`;
            }
        }

        const efectivo = b.total_efectivo_entregado ? `$${parseFloat(b.total_efectivo_entregado).toFixed(2)}` : '<span class="text-muted small">Pendiente</span>';

        let badgeEstatus = '';
        if (b.estatus === 'En_Ruta') {
            badgeEstatus = '<span class="badge bg-warning text-dark">🚚 En Ruta</span>';
        } else if (b.estatus === 'Cerrada_Ruta') {
            badgeEstatus = '<span class="badge bg-danger">🔒 Cerrada</span>';
        } else if (b.estatus === 'Entregada') {
            badgeEstatus = '<span class="badge bg-success">✅ Liquidada</span>';
        }

        // CONDICIONES PARA REABRIR:
        // 1. Debe ser de hoy (b.es_hoy === true)
        // 2. Debe estar Cerrada_Ruta (no En_Ruta ni Entregada)
        let botonReabrir = '';
        if (b.es_hoy && b.estatus === 'Cerrada_Ruta') {
            botonReabrir = `
                <button class="btn btn-warning btn-sm fw-bold text-dark shadow-sm me-1 mb-1" 
                        onclick="reabrirRuta(${b.id_bitacora}, '${escape(b.tecnico)}')">
                    🔓 Reabrir Ruta
                </button>
            `;
        }

        html += `
            <tr>
                <td class="fw-bold">#${b.id_bitacora}</td>
                <td>
                    <span class="text-capitalize">${fechaTxt}</span>
                    ${b.es_hoy ? '<br><span class="badge bg-info text-dark">Hoy</span>' : ''}
                </td>
                <td class="fw-bold text-primary">${b.tecnico}</td>
                <td>${kmTexto}</td>
                <td class="fw-bold text-success">${efectivo}</td>
                <td>${badgeEstatus}</td>
                <td>
                    <div class="d-flex flex-wrap justify-content-center gap-1">
                        ${botonReabrir}
                        <a href="../viewmesacontrol/planeadoractividadestecnico/imprimir_planeador.html?id=${b.id_bitacora}" 
                           target="_blank" class="btn btn-outline-secondary btn-sm mb-1">
                            🖨️ Ver Formato
                        </a>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

async function reabrirRuta(idBitacora, tecnicoEscaped) {
    const tecnico = unescape(tecnicoEscaped);
    const confirmacion = confirm(`¿Estás seguro de REABRIR la ruta del técnico ${tecnico} (Folio #${idBitacora})?\n\nAl reabrirla:\n- El técnico volverá a tener su ruta abierta del día de hoy.\n- Podrá ver su agenda y registrar los nuevos servicios imprevistos.\n- Al finalizar la jornada deberá registrar nuevamente su KM final y su contraseña/firma para cerrarla.`);
    if (!confirmacion) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/bitacoras/${idBitacora}/reabrir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const datos = await respuesta.json();

        if (datos.exito) {
            alert("✅ " + (datos.mensaje || "Ruta reabierta con éxito. El técnico ya puede continuar trabajando."));
            cargarRutasAdmin();
        } else {
            alert("❌ " + (datos.error || "No se pudo reabrir la ruta."));
        }
    } catch (error) {
        console.error("Error al reabrir ruta:", error);
        alert("Error de conexión al intentar reabrir la ruta.");
    }
}

// Cargar rutas cuando se haga clic en la pestaña
document.getElementById('rutas-tab')?.addEventListener('shown.bs.tab', () => {
    cargarRutasAdmin();
});