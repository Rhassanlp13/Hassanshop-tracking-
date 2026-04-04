// admin.js - Hassanshop
const supabaseUrl = 'https://sjwwmfokogoajkwipvdf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqd3dtZm9rb2dvYWprd2lwdmRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNTQ4OTQsImV4cCI6MjA4OTkzMDg5NH0.syn5MY_SFfJuwN5JqNZ6PT2RlNOTYtCaz4YRaBHceWM';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

const estadosNombres = ["Pedido registrado","Preparación USA","Tránsito","Aduana","Ruta entrega","Entregado"];

// DOM
const loginContainer = document.getElementById('login-container');
const adminPanel = document.getElementById('admin-panel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const formNuevo = document.getElementById('form-nuevo');
const listaDiv = document.getElementById('lista-pedidos');
const loginError = document.getElementById('loginError');

// Modal
const modal = document.getElementById('eventoModal');
let currentPedidoId = null;

supabaseClient.auth.getSession().then(({data:{session}})=>{
    if(session) showAdminPanel(); else showLogin();
});
supabaseClient.auth.onAuthStateChange((event,session)=>{
    if(session) showAdminPanel(); else showLogin();
});

function showLogin(){
    loginContainer.style.display='block';
    adminPanel.style.display='none';
}
function showAdminPanel(){
    loginContainer.style.display='none';
    adminPanel.style.display='block';
    cargarPedidos();
}

loginBtn.onclick = async()=>{
    const email = document.getElementById('email').value;
    const pwd = document.getElementById('password').value;
    const {error} = await supabaseClient.auth.signInWithPassword({email,password:pwd});
    if(error) loginError.textContent = 'Error: '+error.message;
    else loginError.textContent='';
};
logoutBtn.onclick = async()=>{ await supabaseClient.auth.signOut(); };

async function cargarPedidos(){
    const {data:pedidos,error} = await supabaseClient.from('pedidos').select('*').order('fecha_creacion',{ascending:false});
    if(error){ listaDiv.innerHTML='<p>Error</p>'; return; }
    listaDiv.innerHTML='';
    for(const p of pedidos){
        const card = document.createElement('div');
        card.className='pedido-card';
        card.innerHTML=`
            <h3>${escapeHtml(p.codigo)} - ${escapeHtml(p.descripcion)}</h3>
            <p><strong>Cliente:</strong> ${escapeHtml(p.cliente_nombre)} (${escapeHtml(p.cliente_email)})</p>
            <p><strong>Estado:</strong> ${estadosNombres[p.estado_actual-1]}</p>
            <button onclick="agregarEvento('${p.id}')">➕ Agregar evento</button>
            <button onclick="editarEstado('${p.id}',${p.estado_actual})">🔄 Estado rápido</button>
            <hr>
        `;
        listaDiv.appendChild(card);
    }
}

window.agregarEvento = (id)=>{
    currentPedidoId = id;
    document.getElementById('evento_titulo').value='';
    document.getElementById('evento_ubicacion').value='';
    document.getElementById('evento_detalle').value='';
    const now = new Date();
    const yyyy=now.getFullYear(), mm=String(now.getMonth()+1).padStart(2,'0'), dd=String(now.getDate()).padStart(2,'0'), hh=String(now.getHours()).padStart(2,'0'), min=String(now.getMinutes()).padStart(2,'0');
    document.getElementById('evento_fecha').value=`${yyyy}-${mm}-${dd}T${hh}:${min}`;
    modal.style.display='flex';
};

document.getElementById('guardarEventoBtn').onclick = async()=>{
    const titulo = document.getElementById('evento_titulo').value.trim();
    const ubicacion = document.getElementById('evento_ubicacion').value.trim() || null;
    const detalle = document.getElementById('evento_detalle').value.trim() || null;
    let fecha = document.getElementById('evento_fecha').value;
    if(!titulo){ alert('Título obligatorio'); return; }
    if(!fecha) fecha = new Date().toISOString();
    else fecha = new Date(fecha).toISOString();
    const {error} = await supabaseClient.from('historial_estados').insert({
        pedido_id: currentPedidoId,
        nombre_estado: titulo,
        ubicacion,
        detalle,
        fecha,
        estado: null
    });
    if(error) alert('Error: '+error.message);
    else {
        alert('Evento agregado');
        modal.style.display='none';
        cargarPedidos();
    }
};
document.getElementById('cancelarEventoBtn').onclick = ()=>{ modal.style.display='none'; };

window.editarEstado = async (id, estadoActual)=>{
    const nuevo = parseInt(prompt(`Estado actual: ${estadosNombres[estadoActual-1]}\n1:${estadosNombres[0]}\n2:${estadosNombres[1]}\n3:${estadosNombres[2]}\n4:${estadosNombres[3]}\n5:${estadosNombres[4]}\n6:${estadosNombres[5]}`));
    if(isNaN(nuevo) || nuevo<1 || nuevo>6){ alert('Inválido'); return; }
    if(nuevo<=estadoActual){ alert('No retroceder'); return; }
    const ubic = prompt('Ubicación (opcional):')||null;
    const det = prompt('Detalle (opcional):')||null;
    await supabaseClient.from('pedidos').update({estado_actual:nuevo, fecha_actualizacion:new Date()}).eq('id',id);
    await supabaseClient.from('historial_estados').insert({
        pedido_id:id, estado:nuevo, nombre_estado:estadosNombres[nuevo-1],
        ubicacion:ubic, detalle:det, fecha:new Date().toISOString()
    });
    alert('Actualizado');
    cargarPedidos();
};

formNuevo.onsubmit = async(e)=>{
    e.preventDefault();
    const codigo = document.getElementById('codigo').value.trim();
    const nombre = document.getElementById('nombre').value.trim();
    const email = document.getElementById('emailCliente').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const desc = document.getElementById('descripcion').value.trim();
    const {data:pedido, error} = await supabaseClient.from('pedidos').insert({
        codigo, cliente_nombre:nombre, cliente_email:email, cliente_telefono:telefono,
        descripcion:desc, estado_actual:1
    }).select().single();
    if(error){ alert('Error: '+error.message); return; }
    await supabaseClient.from('historial_estados').insert({
        pedido_id:pedido.id, estado:1, nombre_estado:estadosNombres[0], fecha:new Date().toISOString()
    });
    alert('Pedido creado');
    formNuevo.reset();
    cargarPedidos();
};

function escapeHtml(str){
    if(!str) return '';
    return str.replace(/[&<>]/g, m=>(m==='&'?'&amp;':m==='<'?'&lt;':'&gt;'));
}
