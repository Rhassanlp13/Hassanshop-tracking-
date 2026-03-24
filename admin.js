// admin.js
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

// Elementos DOM
const loginContainer = document.getElementById('login-container');
const adminPanel = document.getElementById('admin-panel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const formNuevo = document.getElementById('form-nuevo');
const listaDiv = document.getElementById('lista-pedidos');
const loginError = document.getElementById('loginError');

// Verificar sesión actual
supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) showAdminPanel();
    else showLogin();
});

// Escuchar cambios de autenticación
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

// Cargar todos los pedidos
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
      <p><strong>Estado actual:</strong> ${estadosNombres[pedido.estado_actual - 1]}</p>
      <button onclick="editarEstado('${pedido.id}', ${pedido.estado_actual})">Actualizar estado</button>
      <hr>
    `;
        listaDiv.appendChild(card);
    }
}

// Crear nuevo pedido
formNuevo.addEventListener('submit', async (e) => {
    e.preventDefault();
    const codigo = document.getElementById('codigo').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const emailCliente = document.getElementById('emailCliente').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const descripcion = document.getElementById('descripcion').value.trim();

    const { data: pedido, error: insertError } = await supabaseClient
        .from('pedidos')
        .insert({
            codigo,
            cliente_nombre: nombre,
            cliente_email: emailCliente,
            cliente_telefono: telefono,
            descripcion,
            estado_actual: 1
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
            fecha: new Date().toISOString()
        });

    if (histError) {
        alert('Error al guardar historial: ' + histError.message);
    } else {
        alert('Pedido creado correctamente');
        formNuevo.reset();
        cargarPedidos();
    }
});

// Función global para editar estado
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
            fecha: new Date().toISOString()
        });

    if (histError) {
        alert('Error al guardar historial: ' + histError.message);
    } else {
        alert('Estado actualizado correctamente');
        cargarPedidos();
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function (m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}