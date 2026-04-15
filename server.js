const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');

// --- Configuración de Supabase ---
const supabaseUrl = 'https://sjwwmfokogoajkwipvdf.supabase.co';
// Usamos una variable de entorno para la clave por seguridad
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const app = express();
const PORT = process.env.PORT || 3000;

// --- Tus funciones (mapearEstado, extraerPaquetesRestantes, obtenerEventosDesdeWSY, sincronizarPedido) ---
// ¡IMPORTANTE! Copia aquí las funciones exactas de tu archivo `sync-wsy.js`.
// ... (Copia el contenido de las funciones que ya tenías) ...

// --- Nueva función para ejecutar la sincronización y enviar una respuesta ---
async function runSync() {
    console.log('🚀 Iniciando sincronización...');
    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .not('tracking_wsy', 'is', null)
        .lt('estado_actual', 6);

    if (error) {
        console.error('Error obteniendo pedidos:', error);
        return { success: false, error: error.message };
    }

    console.log(`📋 Pedidos a procesar: ${pedidos?.length || 0}`);
    for (const pedido of pedidos) {
        await sincronizarPedido(pedido);
        await new Promise(r => setTimeout(r, 3000));
    }
    console.log('✅ Sincronización completada');
    return { success: true, message: 'Sincronización completada', pedidosProcesados: pedidos?.length || 0 };
}

// --- El Endpoint que llamará cron-job.org ---
app.get('/sync-wsy', async (req, res) => {
    console.log('¡Endpoint /sync-wsy ha sido llamado!');
    try {
        const resultado = await runSync();
        res.status(200).json(resultado);
    } catch (error) {
        console.error('Error fatal en el endpoint:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`Servidor listo. Escuchando en el puerto ${PORT}`);
});