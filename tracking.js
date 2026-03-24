// tracking.js
const supabaseUrl = 'https://sjwwmfokogoajkwipvdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqd3dtZm9rb2dvYWprd2lwdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTQ4OTQsImV4cCI6MjA4OTkzMDg5NH0.syn5MY_SFfJuwN5JqNZ6PT2RlNOTYtCaz4YRaBHceWM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const estadosNombres = [
    "Pedido registrado",
    "En preparación – Centro logístico USA",
    "Tránsito internacional",
    "En aduana – Proceso de desaduanaje",
    "En ruta de entrega",
    "Entregado"
];

// Esperar a que el DOM cargue
document.addEventListener('DOMContentLoaded', function () {
    const buscarBtn = document.getElementById('buscar');
    const codigoInput = document.getElementById('codigo');
    const resultadoDiv = document.getElementById('resultado');

    if (!buscarBtn) {
        console.error('No se encontró el botón de búsqueda');
        return;
    }

    buscarBtn.addEventListener('click', async () => {
        const codigo = codigoInput.value.trim();
        if (!codigo) {
            resultadoDiv.innerHTML = '<div class="error">Por favor ingresa un código</div>';
            return;
        }

        resultadoDiv.innerHTML = '<div class="loading">Buscando pedido...</div>';

        try {
            console.log('Buscando código:', codigo);
            const { data, error } = await supabaseClient.rpc('obtener_pedido', { codigo_param: codigo });

            if (error) {
                console.error('Error de RPC:', error);
                throw error;
            }

            console.log('Datos recibidos:', data);

            if (!data) {
                resultadoDiv.innerHTML = '<div class="error">No se encontró ningún pedido con ese código.</div>';
                return;
            }

            mostrarProgreso(data);
        } catch (error) {
            console.error('Error completo:', error);
            resultadoDiv.innerHTML = '<div class="error">Error al buscar. Intenta de nuevo más tarde.</div>';
        }
    });
});

function mostrarProgreso(pedido) {
    const estadoActualIndex = pedido.estado_actual - 1;

    let html = `<h2>Pedido: ${escapeHtml(pedido.descripcion)}</h2>`;
    html += `<div class="progreso">`;
    for (let i = 0; i < estadosNombres.length; i++) {
        let clase = '';
        if (i < estadoActualIndex) clase = 'completado';
        else if (i === estadoActualIndex) clase = 'actual';
        else clase = 'pendiente';
        html += `<div class="paso ${clase}">${estadosNombres[i]}</div>`;
    }
    html += `</div>`;

    html += `<div class="historial"><h3>Historial de movimientos</h3><ul>`;
    if (pedido.historial && pedido.historial.length) {
        pedido.historial.forEach(est => {
            const fecha = new Date(est.fecha).toLocaleString('es-ES');
            html += `<li><strong>${escapeHtml(est.nombre)}</strong> – ${fecha}`;
            if (est.comentario) html += `<br><span style="font-size:0.9em;">${escapeHtml(est.comentario)}</span>`;
            html += `</li>`;
        });
    } else {
        html += `<li>Sin historial aún</li>`;
    }
    html += `</ul></div>`;

    document.getElementById('resultado').innerHTML = html;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}