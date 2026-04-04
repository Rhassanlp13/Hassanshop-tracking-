// tracking.js - Hassanshop
const supabaseUrl = 'https://sjwwmfokogoajkwipvdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqd3dtZm9rb2dvYWprd2lwdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTQ4OTQsImV4cCI6MjA4OTkzMDg5NH0.syn5MY_SFfJuwN5JqNZ6PT2RlNOTYtCaz4YRaBHceWM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', function () {
    const buscarBtn = document.getElementById('buscar');
    const codigoInput = document.getElementById('codigo');
    const resultadoDiv = document.getElementById('resultado');

    buscarBtn.addEventListener('click', async () => {
        const codigo = codigoInput.value.trim();
        if (!codigo) {
            resultadoDiv.innerHTML = '<div class="error">⚠️ Por favor ingresa un código</div>';
            return;
        }

        resultadoDiv.innerHTML = '<div class="loading">🔍 Buscando pedido...</div>';

        try {
            const { data: pedido, error: pedidoError } = await supabaseClient
                .from('pedidos')
                .select('*')
                .eq('codigo', codigo)
                .single();

            if (pedidoError || !pedido) {
                resultadoDiv.innerHTML = '<div class="error">❌ No se encontró ningún pedido con ese código.</div>';
                return;
            }

            const { data: historial, error: histError } = await supabaseClient
                .from('historial_estados')
                .select('*')
                .eq('pedido_id', pedido.id)
                .order('fecha', { ascending: false });

            if (histError) throw histError;

            mostrarTimeline(pedido, historial || []);
        } catch (error) {
            console.error(error);
            resultadoDiv.innerHTML = '<div class="error">⚠️ Error al buscar. Intenta de nuevo.</div>';
        }
    });
});

function mostrarTimeline(pedido, eventos) {
    let html = `<h2 style="font-size:1.4rem; margin-bottom:8px;">📋 ${escapeHtml(pedido.descripcion)}</h2>`;
    html += `<div class="timeline">`;

    if (eventos.length === 0) {
        html += `<div style="padding: 20px; text-align:center; background:#f1f5f9; border-radius:24px;">🕒 Sin eventos registrados aún</div>`;
    } else {
        eventos.forEach(ev => {
            const fecha = new Date(ev.fecha).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
            html += `<div class="evento">`;
            html += `<div class="evento titulo">✨ ${escapeHtml(ev.nombre_estado)}</div>`;
            if (ev.ubicacion) html += `<div class="evento ubicacion">📍 ${escapeHtml(ev.ubicacion)}</div>`;
            if (ev.detalle) html += `<div class="evento detalle">📝 ${escapeHtml(ev.detalle)}</div>`;
            html += `<div class="evento fecha">🕒 ${fecha}</div>`;
            html += `</div>`;
        });
    }
    html += `</div>`;
    document.getElementById('resultado').innerHTML = html;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
