// Esperamos a que la página cargue completamente
document.addEventListener('DOMContentLoaded', () => {
    
    const btnProbar = document.getElementById('btn-probar-conexion');
    const divResultado = document.getElementById('resultado-conexion');

    btnProbar.addEventListener('click', async () => {
        try {
            // Le cambiamos el texto al botón mientras busca
            btnProbar.innerText = "Conectando...";
            
            // Hacemos la petición a tu API local
            const respuesta = await fetch('http://localhost:3000/api/test-db');
            const datos = await respuesta.json();

            // Mostramos el resultado en la pantalla
            divResultado.innerText = datos.mensaje + " Base de datos: " + datos.datos.nombre_bd;
            btnProbar.innerText = "¡Conectado!";
            btnProbar.classList.replace('btn-outline-success', 'btn-success');

        } catch (error) {
            console.error("Error al conectar:", error);
            divResultado.innerText = "Error: El servidor backend está apagado o hay un problema de CORS.";
            divResultado.classList.replace('text-success', 'text-danger');
            btnProbar.innerText = "Reintentar Conexión";
        }
    });
});