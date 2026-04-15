// admin.js
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

// Elementos DOM
const loginContainer = document.getElementById('login-container');
const adminPanel = document.getElementById('admin-panel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const formNuevo = document.getElementById('form-nuevo');
const listaDiv = document.getElementById('lista-pedidos');
const loginError = document.getElementById('loginError');

// ===================== GENERADOR DE CÓDIGOS =====================
function generarCodigoHassanshop() {
    const prefijo = "Hassanshop-";
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let resultado = '';
    for (let i = 0; i < 6; i++) {
        resultado += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return prefijo + resultado;
}

async function generarCodigoUnico() {
    let existe = true;
    let nuevoCodigo = '';
    while (existe) {
        nuevoCodigo = generarCodigoHassanshop();
        const { data, error } = await supabaseClient
            .from('pedidos')
            .select('codigo')
            .eq('codigo', nuevoCodigo)
            .maybeSingle();
        if (!data) existe = false;
    }
    return nuevoCodigo;
}

// ===================== AUTENTICACIÓN =====================
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showAdminPanel();
    else showLogin();
});

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (session) showAdminPanel();
    else showLogin();
});

function showLogin() {
    loginContainer.style.display = 'block';
    adminPanel.style.display = 'none';
}

function showAdminPanel() {
    loginContainer.style.display = 'none';
    adminPanel.style.display = 'block';
    cargarPedidos();
    // Sugerir código automáticamente al cargar el panel
    const codigoInput = document.getElementById('codigo');
    if (codigoInput && !codigoInput.value) {
        generarCodigoUnico().then(codigo => {
            codigoInput.value = codigo;
        });
    }
}

// Login
loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) loginError.textContent = 'Error: ' + error.message;
    else loginError.textContent = '';
});

// Logout
logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// ===================== LISTAR PEDIDOS =====================
async function cargarPedidos() {
    const { data: pedidos, error } = await supabaseClient
        .from('pedidos')
        .select('*')
        .order('fecha_creacion', { ascending: false });

    if (error) {
        console.error(error);
        listaDiv.innerHTML = '<p>Error cargando pedidos</p>';
        return;
    }

    listaDiv.innerHTML = '';
    for (const pedido of pedidos) {
        const card = document.createElement('div');
        card.className = 'pedido-card';
        card.innerHTML = `
            <h3>${escapeHtml(pedido.codigo)} - ${escapeHtml(pedido.descripcion)}</h3>
            <p><strong>Cliente:</strong> ${escapeHtml(pedido.cliente_nombre)} (${escapeHtml(pedido.cliente_email)})</p>
            <p><strong>Destino final:</strong> ${escapeHtml(pedido.destino_final || 'No especificado')}</p>
            <p><strong>WSY Tracking:</strong> ${escapeHtml(pedido.tracking_wsy || 'No asignado')}</p>
            <p><strong>Estado actual:</strong> ${estadosNombres[pedido.estado_actual - 1]}</p>
            <button onclick="editarEstado('${pedido.id}', ${pedido.estado_actual})">Actualizar estado</button>
            <button onclick="agregarEvento('${pedido.id}', ${pedido.estado_actual})">➕ Agregar evento (ubicación, comentario)</button>
            <hr>
        `;
        listaDiv.appendChild(card);
    }
}

// ===================== CREAR NUEVO PEDIDO =====================
formNuevo.addEventListener('submit', async (e) => {
    e.preventDefault();
    let codigo = document.getElementById('codigo').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const emailCliente = document.getElementById('emailCliente').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();
    const destinoFinal = document.getElementById('destinoFinal')?.value.trim() || '';
    const trackingWsy = document.getElementById('trackingWsy')?.value.trim() || '';

    // Si no se ingresó código manual, generar uno automático
    if (!codigo) {
        codigo = await generarCodigoUnico();
        document.getElementById('codigo').value = codigo;
    } else {
        // Verificar que el código ingresado no exista ya
        const { data: existe } = await supabaseClient
            .from('pedidos')
            .select('codigo')
            .eq('codigo', codigo)
            .maybeSingle();
        if (existe) {
            alert('El código ya existe. Usa otro o genera uno automático.');
            return;
        }
    }

    const { data: pedido, error: insertError } = await supabaseClient
        .from('pedidos')
        .insert({
            codigo,
            cliente_nombre: nombre,
            cliente_email: emailCliente,
            cliente_telefono: telefono,
            descripcion,
            estado_actual: 1,
            destino_final: destinoFinal || null,
            tracking_wsy: trackingWsy || null
        })
        .select()
        .single();

    if (insertError) {
        alert('Error al crear pedido: ' + insertError.message);
        return;
    }

    const { error: histError } = await supabaseClient
        .from('historial_estados')
        .insert({
            pedido_id: pedido.id,
            estado: 1,
            nombre_estado: estadosNombres[0],
            fecha: new Date().toISOString(),
            ubicacion: null,
            comentario_extra: null,
            paquetes_restantes: null
        });

    if (histError) {
        alert('Error al guardar historial: ' + histError.message);
    } else {
        alert('Pedido creado correctamente');
        formNuevo.reset();
        cargarPedidos();
        // Generar nuevo código sugerido para el siguiente pedido
        const nuevoCodigo = await generarCodigoUnico();
        document.getElementById('codigo').value = nuevoCodigo;
    }
});

// ===================== EDITAR ESTADO (BÁSICO) =====================
window.editarEstado = async (id, estadoActual) => {
    const nuevoEstadoNum = parseInt(prompt(`Estado actual: ${estadosNombres[estadoActual - 1]}\n\nNuevo estado (1-6):\n1 = ${estadosNombres[0]}\n2 = ${estadosNombres[1]}\n3 = ${estadosNombres[2]}\n4 = ${estadosNombres[3]}\n5 = ${estadosNombres[4]}\n6 = ${estadosNombres[5]}`, estadoActual + 1));
    if (isNaN(nuevoEstadoNum) || nuevoEstadoNum < 1 || nuevoEstadoNum > 6) {
        alert('Número inválido');
        return;
    }
    if (nuevoEstadoNum <= estadoActual) {
        alert('No se puede retroceder a un estado anterior.');
        return;
    }

    const { error: updateError } = await supabaseClient
        .from('pedidos')
        .update({ estado_actual: nuevoEstadoNum, fecha_actualizacion: new Date().toISOString() })
        .eq('id', id);

    if (updateError) {
        alert('Error al actualizar estado: ' + updateError.message);
        return;
    }

    const { error: histError } = await supabaseClient
        .from('historial_estados')
        .insert({
            pedido_id: id,
            estado: nuevoEstadoNum,
            nombre_estado: estadosNombres[nuevoEstadoNum - 1],
            fecha: new Date().toISOString(),
            ubicacion: null,
            comentario_extra: null,
            paquetes_restantes: null
        });

    if (histError) {
        alert('Error al guardar historial: ' + histError.message);
    } else {
        alert('Estado actualizado correctamente');
        cargarPedidos();
    }
};

// ===================== AGREGAR EVENTO DETALLADO =====================
window.agregarEvento = async (pedidoId, estadoActual) => {
    const estado = prompt(`Estado (número 1-6):\n1 = ${estadosNombres[0]}\n2 = ${estadosNombres[1]}\n3 = ${estadosNombres[2]}\n4 = ${estadosNombres[3]}\n5 = ${estadosNombres[4]}\n6 = ${estadosNombres[5]}`, "5");
    if (!estado || estado < 1 || estado > 6) return;
    const nuevoEstadoNum = parseInt(estado);

    const ubicacion = prompt("Ubicación (ej: Manzanillo - Cuba):", "");
    const comentario = prompt("Comentario adicional (ej: ¡Su paquete está en movimiento! o El conductor está completando otra entrega):", "");
    const paquetes = prompt("Paquetes restantes (opcional, solo número):", "");

    const { error: histError } = await supabaseClient
        .from('historial_estados')
        .insert({
            pedido_id: pedidoId,
            estado: nuevoEstadoNum,
            nombre_estado: estadosNombres[nuevoEstadoNum - 1],
            fecha: new Date().toISOString(),
            ubicacion: ubicacion || null,
            comentario_extra: comentario || null,
            paquetes_restantes: paquetes ? parseInt(paquetes) : null
        });

    if (histError) {
        alert('Error al guardar evento: ' + histError.message);
        return;
    }

    if (nuevoEstadoNum > estadoActual) {
        const { error: updateError } = await supabaseClient
            .from('pedidos')
            .update({ estado_actual: nuevoEstadoNum, fecha_actualizacion: new Date().toISOString() })
            .eq('id', pedidoId);
        if (updateError) {
            console.error("No se pudo actualizar estado_actual:", updateError);
        }
    }

    alert('Evento agregado correctamente');
    cargarPedidos();
};

// ===================== ESCAPE HTML =====================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ===================== BOTÓN GENERAR MANUAL (opcional) =====================
// Si existe el botón "generarCodigo" en el HTML, lo conectamos
document.addEventListener('DOMContentLoaded', () => {
    const generarBtn = document.getElementById('generarCodigo');
    if (generarBtn) {
        generarBtn.addEventListener('click', async () => {
            const codigoInput = document.getElementById('codigo');
            const nuevoCodigo = await generarCodigoUnico();
            codigoInput.value = nuevoCodigo;
        });
    }
});