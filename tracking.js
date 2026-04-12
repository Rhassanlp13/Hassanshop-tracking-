// tracking.js
const supabaseUrl = 'https://sjwwmfokogoajkwipvdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqd3dtZm9rb2dvYWprd2lwdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTQ4OTQsImV4cCI6MjA4OTkzMDg5NH0.syn5MY_SFfJuwN5JqNZ6PT2RlNOTYtCaz4YRaBHceWM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const estadosNombres = [
    "Encargo recibido",
    "Compra en proceso",
    "En tránsito internacional",
    "En aduana – Gestión documental",
    "En ruta de entrega final",
    "Entregado al cliente"
];

document.addEventListener('DOMContentLoaded', function () {
    const buscarBtn = document.getElementById('buscar');
    const codigoInput = document.getElementById('codigo');
    const resultadoDiv = document.getElementById('resultado');

    if (!buscarBtn) return;

    buscarBtn.addEventListener('click', async () => {
        const codigo = codigoInput.value.trim();
        if (!codigo) {
            resultadoDiv.innerHTML = '<div class="error">Por favor ingresa un código</div>';
            return;
        }

        resultadoDiv.innerHTML = '<div class="loading">Buscando pedido...</div>';

        try {
            const { data, error } = await supabaseClient.rpc('obtener_pedido', { codigo_param: codigo });

            if (error) throw error;

            if (!data) {
                resultadoDiv.innerHTML = '<div class="error">No se encontró ningún pedido con ese código.</div>';
                return;
            }

            mostrarProgreso(data);
        } catch (error) {
            console.error(error);
            resultadoDiv.innerHTML = '<div class="error">Error al buscar. Intenta de nuevo más tarde.</div>';
        }
    });
});

function mostrarProgreso(pedido) {
    const estadoActualIndex = pedido.estado_actual - 1;

    let html = `<h2>Pedido: ${escapeHtml(pedido.descripcion)}</h2>`;

    // Mostrar destino final si existe
    if (pedido.destino_final) {
        html += `<div class="destino"><strong>🎯 Destino:</strong> ${escapeHtml(pedido.destino_final)}</div>`;
    }

    // Barra de progreso
    html += `<div class="progreso">`;
    for (let i = 0; i < estadosNombres.length; i++) {
        let clase = '';
        if (i < estadoActualIndex) clase = 'completado';
        else if (i === estadoActualIndex) clase = 'actual';
        else clase = 'pendiente';
        html += `<div class="paso ${clase}">${estadosNombres[i]}</div>`;
    }
    html += `</div>`;

    // Historial detallado
    html += `<div class="historial"><h3>Historial de movimientos</h3><ul>`;
    if (pedido.historial && pedido.historial.length) {
        pedido.historial.forEach(est => {
            const fecha = new Date(est.fecha).toLocaleString('es-ES');
            let ubicacionHtml = est.ubicacion ? `<br><span class="ubicacion">📍 ${escapeHtml(est.ubicacion)}</span>` : '';
            let extraHtml = '';
            if (est.comentario_extra) extraHtml += `<br><span class="comentario">${escapeHtml(est.comentario_extra)}</span>`;
            if (est.paquetes_restantes) extraHtml += `<br><span class="paquetes">📦 Quedan ${est.paquetes_restantes} paquetes por entregar</span>`;

            html += `<li>
                <strong>${escapeHtml(est.nombre_estado)}</strong> – ${fecha}
                ${ubicacionHtml}
                ${extraHtml}
            </li>`;
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