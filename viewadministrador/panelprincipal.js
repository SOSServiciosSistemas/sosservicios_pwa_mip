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