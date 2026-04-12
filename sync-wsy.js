// sync-wsy.js
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

// ========== CONFIGURACIÓN ==========
const supabaseUrl = 'https://sjwwmfokogoajkwipvdf.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // ⚠️ Usa variable de entorno
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Los mismos estados que usas en admin.js (para actualizar estado_actual)
const estadosNombres = [
    "Encargo recibido",
    "Compra en proceso",
    "En tránsito internacional",
    "En aduana – Gestión documental",
    "En ruta de entrega final",
    "Entregado al cliente"
];

// Mapeo de textos de estado de WSY a tus estados (1-6)
function mapearEstado(textoEstado) {
    const lower = textoEstado.toLowerCase();
    if (lower.includes('entregado')) return 6;
    if (lower.includes('en camino para entrega') || lower.includes('en ruta de entrega')) return 5;
    if (lower.includes('despacho de aduana') || lower.includes('aduan')) return 4;
    if (lower.includes('vuelo') || lower.includes('tránsito') || lower.includes('transito')) return 3;
    if (lower.includes('preparado') || lower.includes('compra') || lower.includes('proceso')) return 2;
    return 1;
}

// Extraer número de paquetes restantes de los comentarios (si aparecen)
function extraerPaquetesRestantes(texto) {
    const match = texto?.match(/Quedan\s+(\d+)\s+paquetes?/i);
    return match ? parseInt(match[1]) : null;
}

// Scraping de la página de tracking de WSY usando la URL real
async function obtenerEventosDesdeWSY(trackingNumber) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // URL oficial de WSY en español
    const url = `https://weshipyou.com/es/tracking/${encodeURIComponent(trackingNumber)}`;
    console.log(`🌐 Accediendo: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Esperar a que carguen los elementos de la línea de tiempo
    await page.waitForSelector('.MuiTimelineItem-root', { timeout: 15000 }).catch(() => {
        console.log(`No se encontraron eventos para ${trackingNumber}`);
    });

    // Extraer datos con selectores basados en el HTML que me proporcionaste
    const eventos = await page.evaluate(() => {
        const items = document.querySelectorAll('.MuiTimelineItem-root');
        return Array.from(items).map(item => {
            // Fecha (último .MuiTypography-caption dentro del contenido)
            const fechaElem = item.querySelector('.MuiTimelineContent-root .MuiTypography-caption:last-child');
            let fechaTexto = fechaElem ? fechaElem.innerText.trim() : '';

            // Estado (p .MuiTypography-body2)
            const estadoElem = item.querySelector('.MuiTimelineContent-root p.MuiTypography-body2');
            let estado = estadoElem ? estadoElem.innerText.trim() : '';

            // Ciudad (dentro del chip)
            const chipLabel = item.querySelector('.MuiChip-label');
            let ciudad = chipLabel ? chipLabel.innerText.trim() : '';

            // País (span .MuiTypography-caption que está junto al chip, pero no es la fecha)
            let pais = '';
            const chipContainer = item.querySelector('.MuiStack-root .MuiChip-root')?.parentElement;
            if (chipContainer) {
                const captionSpan = chipContainer.querySelector('.MuiTypography-caption');
                if (captionSpan && !captionSpan.innerText.includes('Mostrar mensajes técnicos')) {
                    pais = captionSpan.innerText.trim();
                }
            }

            // Comentario adicional (puede estar en un div oculto o al hacer clic en "Mostrar mensajes técnicos")
            // Por ahora buscamos texto dentro de .MuiTypography-body1 que no sea el estado
            let comentario = '';
            const body1Elem = item.querySelector('.MuiTypography-body1');
            if (body1Elem && body1Elem.innerText !== estado) {
                comentario = body1Elem.innerText.trim();
            }

            // Si hay un botón "Mostrar mensajes técnicos", podríamos hacer clic (más complejo)
            // Lo dejamos para una mejora futura si es necesario

            // Construir ubicación
            let ubicacion = '';
            if (ciudad && pais) ubicacion = `${ciudad} - ${pais}`;
            else if (ciudad) ubicacion = ciudad;
            else if (pais) ubicacion = pais;

            return { fechaTexto, estado, ubicacion, comentario };
        });
    });

    await browser.close();

    // Procesar fechas (formato: "13 mar 2026, 2:16 p. m.")
    const eventosConFecha = eventos.map(ev => {
        let fecha = null;
        if (ev.fechaTexto) {
            // Limpiar y convertir a Date
            let limpio = ev.fechaTexto
                .replace(/\./g, '')
                .replace('p m', 'PM')
                .replace('a m', 'AM');
            fecha = new Date(limpio);
            if (isNaN(fecha)) fecha = null;
        }
        return { ...ev, fecha };
    }).filter(ev => ev.estado); // solo eventos con estado

    // Si no pudimos parsear fechas, asumimos orden inverso (el más reciente primero) y generamos fechas ficticias secuenciales
    if (eventosConFecha.some(ev => !ev.fecha)) {
        eventosConFecha.reverse(); // el más antiguo ahora primero
        let baseDate = new Date();
        for (let i = 0; i < eventosConFecha.length; i++) {
            if (!eventosConFecha[i].fecha) {
                eventosConFecha[i].fecha = new Date(baseDate.getTime() - (eventosConFecha.length - i) * 60000);
            }
        }
    } else {
        // Ordenar de más antiguo a más nuevo
        eventosConFecha.sort((a, b) => a.fecha - b.fecha);
    }

    return eventosConFecha;
}

// Sincronizar un pedido individual
async function sincronizarPedido(pedido) {
    console.log(`\n🔍 Sincronizando pedido ${pedido.codigo} (WSY: ${pedido.tracking_wsy})`);
    let eventos;
    try {
        eventos = await obtenerEventosDesdeWSY(pedido.tracking_wsy);
    } catch (err) {
        console.error(`Error scraping WSY: ${err.message}`);
        return;
    }

    if (eventos.length === 0) {
        console.log(`No se encontraron eventos para ${pedido.tracking_wsy}`);
        return;
    }

    let ultimoEstadoNum = pedido.estado_actual;

    for (const ev of eventos) {
        // Verificar si ya existe un evento con la misma fecha y texto de estado
        const { data: existente } = await supabase
            .from('historial_estados')
            .select('id')
            .eq('pedido_id', pedido.id)
            .eq('fecha', ev.fecha.toISOString())
            .eq('nombre_estado', ev.estado)
            .maybeSingle();

        if (existente) continue;

        const estadoNum = mapearEstado(ev.estado);
        const paquetes = extraerPaquetesRestantes(ev.comentario);

        // Insertar en historial_estados
        const { error: insertError } = await supabase
            .from('historial_estados')
            .insert({
                pedido_id: pedido.id,
                estado: estadoNum,
                nombre_estado: ev.estado,  // Guardamos el texto original de WSY (no se mostrará al cliente)
                fecha: ev.fecha.toISOString(),
                ubicacion: ev.ubicacion || null,
                comentario_extra: ev.comentario || null,
                paquetes_restantes: paquetes
            });

        if (insertError) {
            console.error(`Error insertando evento: ${insertError.message}`);
        } else {
            console.log(`✅ Insertado: ${ev.estado} - ${ev.ubicacion} (${ev.fecha.toISOString()})`);
            if (estadoNum > ultimoEstadoNum) ultimoEstadoNum = estadoNum;
        }
    }

    // Actualizar estado_actual del pedido si es necesario
    if (ultimoEstadoNum > pedido.estado_actual) {
        await supabase
            .from('pedidos')
            .update({ estado_actual: ultimoEstadoNum, fecha_actualizacion: new Date().toISOString() })
            .eq('id', pedido.id);
        console.log(`📦 Pedido ${pedido.codigo} actualizado a estado ${estadosNombres[ultimoEstadoNum - 1]}`);
    }
}

// Función principal
async function main() {
    console.log('🚀 Iniciando sincronización con We Ship You...');
    const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('*')
        .not('tracking_wsy', 'is', null)
        .lt('estado_actual', 6); // Solo pedidos no entregados

    if (error) {
        console.error('Error obteniendo pedidos:', error);
        return;
    }

    console.log(`📋 Pedidos a procesar: ${pedidos.length}`);
    for (const pedido of pedidos) {
        await sincronizarPedido(pedido);
        await new Promise(r => setTimeout(r, 3000)); // Pausa de 3 segundos entre pedidos
    }
    console.log('✅ Sincronización completada.');
}

main();