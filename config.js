// Archivo central de configuración (config.js)
const BASE_URL = 'https://api.sosservicios.com.mx';

// ============================================================================
// 1. INTERCEPTOR GLOBAL DE FETCH (Inyección automática de Token JWT)
// ============================================================================
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(url, options = {}) {
        const token = localStorage.getItem('tokenAuth');
        if (token) {
            options.headers = options.headers || {};
            if (options.headers instanceof Headers) {
                if (!options.headers.has('Authorization')) {
                    options.headers.set('Authorization', 'Bearer ' + token);
                }
            } else if (Array.isArray(options.headers)) {
                options.headers.push(['Authorization', 'Bearer ' + token]);
            } else {
                if (!options.headers['Authorization'] && !options.headers['authorization']) {
                    options.headers['Authorization'] = 'Bearer ' + token;
                }
            }
        }
        
        const response = await originalFetch.call(window, url, options);

        // Si la petición retorna 401 por falta de token o token expirado, y no estamos en la página de login
        if (response.status === 401) {
            const esLogin = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname === '';
            if (!esLogin) {
                try {
                    const clone = response.clone();
                    const data = await clone.json();
                    if (data && data.error && (data.error.includes('token') || data.error.includes('autenticado') || data.error.includes('sesión') || data.error.includes('expirado'))) {
                        console.warn("Sesión caducada o token no válido:", data.error);
                        localStorage.clear();
                        const esSubcarpeta = window.location.pathname.includes('/view') || window.location.pathname.includes('/documentos');
                        alert("Tu sesión ha expirado o requiere autenticación actualizada. Por favor inicia sesión nuevamente.");
                        window.location.href = esSubcarpeta ? '../index.html' : 'index.html';
                    }
                } catch(e) {}
            }
        }

        return response;
    };
})();

// ============================================================================
// 2. FUNCIÓN GLOBAL PARA CIERRE DE SESIÓN LIMPIO
// ============================================================================
window.cerrarSesion = function() {
    localStorage.clear();
    const esSubcarpeta = window.location.pathname.includes('/view') || window.location.pathname.includes('/documentos');
    window.location.href = esSubcarpeta ? '../index.html' : 'index.html';
};

// ============================================================================
// 3. GUARDA DE SEGURIDAD Y VALIDACIÓN DE ROL CONTRA EL SERVIDOR
// ============================================================================
window.validarAccesoVista = async function(rolesPermitidos = []) {
    const token = localStorage.getItem('tokenAuth');
    const idUsuario = localStorage.getItem('idUsuario');

    const esSubcarpeta = window.location.pathname.includes('/view') || window.location.pathname.includes('/documentos');
    const rutaLogin = esSubcarpeta ? '../index.html' : 'index.html';

    // 1. Si no hay sesión local o token, expulsar al login
    if (!token || !idUsuario) {
        alert('Se ha actualizado la seguridad del sistema. Por favor inicia sesión nuevamente para generar tu clave de acceso.');
        localStorage.clear();
        window.location.href = rutaLogin;
        return false;
    }

    // 2. Validar con el backend la autenticidad del token y el rol real en BD
    try {
        const res = await fetch(`${BASE_URL}/api/verificar-sesion`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const datos = await res.json();

        if (!datos.exito || !datos.usuario) {
            alert('Tu sesión ha expirado o no es válida. Por favor, inicia sesión de nuevo.');
            localStorage.clear();
            window.location.href = rutaLogin;
            return false;
        }

        const usuarioReal = datos.usuario;

        // Sobreescribir con la verdad del servidor (inmunidad contra alteración en DevTools)
        localStorage.setItem('rolUsuario', usuarioReal.rol);
        localStorage.setItem('nombreUsuario', usuarioReal.nombre_completo);

        // 3. Comprobar que el rol real tenga autorización para esta vista
        if (rolesPermitidos.length > 0) {
            const tieneAcceso = rolesPermitidos.some(r => {
                if (r === 'Admin' || r === 'Administrador') {
                    return usuarioReal.rol === 'Admin' || usuarioReal.rol === 'Administrador';
                }
                return usuarioReal.rol === r;
            });

            if (!tieneAcceso) {
                alert(`Acceso no autorizado: Tu cuenta (${usuarioReal.rol}) no tiene permisos para este panel.`);
                const prefijo = esSubcarpeta ? '../' : '';
                if (usuarioReal.rol === 'Tecnico') {
                    window.location.href = prefijo + 'viewtecnico/tecnico.html';
                } else if (usuarioReal.rol === 'Mesa_Control') {
                    window.location.href = prefijo + 'viewmesacontrol/panel.html';
                } else if (usuarioReal.rol === 'Admin' || usuarioReal.rol === 'Administrador') {
                    window.location.href = prefijo + 'viewadministrador/panelprincipal.html';
                } else if (usuarioReal.rol === 'Direccion') {
                    window.location.href = prefijo + 'viewdireccion/panel.html';
                } else {
                    window.location.href = prefijo + 'index.html';
                }
                return false;
            }
        }

        return true;
    } catch (e) {
        // En caso de estar offline (sin conexión a internet), permitir flujo si ya tenía token guardado
        console.warn('Aviso: Operando en modo offline o sin conexión con API:', e.message);
        return true;
    }
};
