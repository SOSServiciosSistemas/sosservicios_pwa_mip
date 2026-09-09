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
});

// Cerrar sesión
document.getElementById('btn-cerrar-sesion').addEventListener('click', () => {
    localStorage.clear();
    window.location.href = "../index.html";
});

// ==========================================
// MÓDULO DE USUARIOS
// ==========================================
async function cargarUsuarios() {
    try {
        const respuesta = await fetch(BASE_URL + '/api/admin/usuarios');
        const datos = await respuesta.json();
        
        const tbody = document.getElementById('tabla-usuarios');
        tbody.innerHTML = ''; 

        if(datos.exito) {
            datos.usuarios.forEach(user => {
                const fila = `
                    <tr>
                        <td>${user.nombre_completo}</td>
                        <td>${user.usuario}</td>
                        <td><span class="badge bg-secondary">${user.rol}</span></td>
                        <td>
                            <span class="badge ${user.activo ? 'bg-success' : 'bg-danger'}">
                                ${user.activo ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-sm ${user.activo ? 'btn-danger' : 'btn-success'}" 
                                onclick="cambiarEstatusUsuario(${user.id_usuario}, ${!user.activo})">
                                ${user.activo ? 'Desactivar' : 'Reactivar'}
                            </button>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += fila;
            });
        }
    } catch (error) {
        console.error("Error al cargar usuarios:", error);
    }
}

async function cambiarEstatusUsuario(id, nuevoEstatus) {
    if(!confirm(`¿Estás seguro de cambiar el estatus de este usuario?`)) return;

    try {
        const respuesta = await fetch(BASE_URL + `/api/admin/usuarios/${id}/estatus`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstatus })
        });
        const datos = await respuesta.json();
        
        if(datos.exito) {
            cargarUsuarios(); // Recarga la tabla
        } else {
            alert("Error: " + datos.error);
        }
    } catch (error) {
        console.error("Error al cambiar estatus:", error);
    }
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
                const fila = `
                    <tr>
                        <td>${producto.nombre_comercial}</td>
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
        document.getElementById('prod-subcategoria').value = '';
        document.getElementById('prod-ingrediente').value = '';
        document.getElementById('prod-registro').value = '';
    }
});

// Guardar el nuevo producto en la base de datos
document.getElementById('form-nuevo-producto').addEventListener('submit', async function(e) {
    e.preventDefault(); // Evita que la página se recargue

    // Recopilamos los datos del formulario
    const nuevoProducto = {
        nombre_comercial: document.getElementById('prod-nombre').value,
        clave_producto: document.getElementById('prod-clave').value,
        categoria: document.getElementById('prod-categoria').value,
        unidad_medida: document.getElementById('prod-unidad').value,
        capacidad_presentacion: document.getElementById('prod-presentacion').value,
        stock_minimo: document.getElementById('prod-stock-min').value,
        
        // Estos campos solo tendrán valor si es Químico, si no, se enviarán vacíos
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