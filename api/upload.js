import { google } from 'googleapis';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const data = req.body;
    const tecnico = data.Tecnico || 'Sin_Nombre';
    const observaciones = data.Observaciones || 'Sin especificaciones de Radios/RB.';
    const fechaActual = new Date().toLocaleDateString('es-MX');

    // ID fijo de tu carpeta de Google Drive
    const CARPETA_DRIVE_ID = "1d0rTRiT7eSh0cmtIFXLbbmqyRuhxbRCm"; 

    // 1. Autenticación con Google Drive
    const auth = new google.auth.JWT(
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      null,
      process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      ['https://www.googleapis.com/auth/drive.file']
    );
    const drive = google.drive({ version: 'v3', auth });

    // 2. Crear el documento PDF
    const doc = new PDFDocument({ margin: 40 });
    const buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    
    const pdfBuild = new Promise((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(buffers)));
    });

    // --- DISEÑO CORPORATIVO DEL REPORTE PDF ---
    doc.rect(0, 0, 612, 60).fill('#1a365d'); 
    doc.fillColor('#ffffff').fontSize(14).text('PROTOKOL TELECOM — CHECKLIST DE SALIDA', 25, 22, { bold: true });
    
    doc.fillColor('#2d3748').fontSize(10).text(`Responsable de Cuadrilla: ${tecnico}`, 25, 80);
    doc.text(`Fecha de Emisión: ${fechaActual}`, 430, 80);
    doc.moveTo(25, 95).lineTo(585, 95).stroke('#cbd5e0');

    doc.fontSize(11).fillColor('#1a365d').text('ESTADO DE REVISIÓN DEL INVENTARIO:', 25, 110, { underline: true });
    
    let y = 135;
    const itemsChecklist = [
      { key: 'Fusionadora', label: 'Fusionadora de fibra (electrodos OK y corte limpio)' },
      { key: 'Cleaver', label: 'Cortadora de precisión (cleaver)' },
      { key: 'OTDR', label: 'OTDR con puertos SC/APC y SC/UP' },
      { key: 'Power_Meter', label: 'Medidor de potencia óptica (PON)' },
      { key: 'VFL', label: 'Fuente de luz visible (VFL)' },
      { key: 'Desforadora_Plana', label: 'Desforadora para fibra plana (Opcional)' },
      { key: 'Regleta_Fibra', label: 'Regleta para fibra' },
      { key: 'Pelacables', label: 'Pelacables de fibra (anillo o triangular)' },
      { key: 'Tijeras_Kevlar', label: 'Tijeras de kevlar (para drop)' },
      { key: 'Pinzas_Punta', label: 'Pinzas de punta' },
      { key: 'Cutter', label: 'Navaja de precisión (cutter)' },
      { key: 'Destornilladores', label: 'Destornilladores (plano, estrella, Torx)' },
      { key: 'Taladro', label: 'Taladro percutor con brocas (6mm y 12mm)' },
      { key: 'Martillo', label: 'Martillo (Opcional)' },
      { key: 'Pinzas_Electricista', label: 'Pinzas de electricista' },
      { key: 'Guias_Pasacables', label: 'Guías pasacables (varillas flexibles)' },
      { key: 'Corte_Diagonal', label: 'Pinzas de corte diagonal' },
      { key: 'Drop_Cable', label: 'Cable de bajada (drop cable) autosoporte' },
      { key: 'Rosetas', label: 'Rosetas / cajas de usuario' },
      { key: 'Conectores_APC', label: 'Conectores SC/APC (Monomodo)' },
      { key: 'Conectores_UPC', label: 'Conectores SC/UPC' },
      { key: 'Pigtails', label: 'Pigtails (9/125, longitud 1.5m) de repuesto' },
      { key: 'Tornillos_Bridas', label: 'Tornillos, tacos de pared y bridas' },
      { key: 'Cintas', label: 'Cinta aislante negra y cinta doble cara' },
      { key: 'Alcohol_Isopropilico', label: 'Alcohol isopropílico y toallitas' },
      { key: 'Etiquetas', label: 'Etiquetas termorretráctiles o autoadhesivas' },
      { key: 'ONT', label: 'ONT (Unidad de red óptica) - Módem' },
      { key: 'Fuente_ONT', label: 'Fuente de alimentación / adaptador ONT' },
      { key: 'Patch_Cord', label: 'Cable de parcheo Ethernet (CAT6) corto' },
      { key: 'Tablet_Celular', label: 'Tablet o celular con app de gestión' },
      { key: 'Formularios', label: 'Formularios de aceptación / Orden de Servicio' }
    ];

    itemsChecklist.forEach((item) => {
      const status = data[item.key] === 'OK' ? '[ OK ]' : '[FALTA]';
      doc.fillColor(data[item.key] === 'OK' ? '#10b981' : '#ef4444').text(status, 25, y);
      doc.fillColor('#2d3748').text(item.label, 85, y);
      y += 15;

      if (y > 700) {
        doc.addPage();
        y = 40;
      }
    });

    y += 20;
    if (y > 650) { doc.addPage(); y = 40; }
    
    doc.fillColor('#1a365d').text('REPORTES DE RADIOS Y RB ASIGNADOS / NOTAS:', 25, y, { bold: true });
    y += 15;
    doc.fillColor('#4a5568').text(observaciones, 25, y, { width: 520 });

    doc.moveTo(50, 730).lineTo(200, 730).stroke('#4a5568');
    doc.text('Firma del Técnico', 75, 735);

    doc.moveTo(380, 730).lineTo(530, 730).stroke('#4a5568');
    doc.text('Firma Supervisor / Control', 400, 735);

    doc.end();
    
    const finalPdfBuffer = await pdfBuild;
    const streamPdf = Readable.from(finalPdfBuffer);
    
    // 3. Guardar el PDF directamente en tu carpeta de Google Drive
    await drive.files.create({
      requestBody: {
        name: `Checklist_${tecnico.replace(/\s+/g, '_')}_${fechaActual.replace(/\//g, '-')}.pdf`,
        parents: [CARPETA_DRIVE_ID],
      },
      media: {
        mimeType: 'application/pdf',
        body: streamPdf,
      },
    });

    // 4. Pantalla de confirmación para el técnico
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`
      <div style="font-family:sans-serif; text-align:center; padding:50px; background-color:#111827; color:#fff; min-height:100vh;">
        <h2 style="color:#10B981; font-size: 24px;">🚀 ¡Checklist Guardada en Drive!</h2>
        <p style="color:#9CA3AF; font-size: 16px; margin-top: 10px;">El reporte en PDF ha sido enviado directamente al archivo digital centralizado de la empresa.</p>
        <p style="font-size:12px; color:#6B7280; margin-top:30px;">Ya puedes cerrar esta pestaña o regresar.</p>
      </div>
    `);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Error al procesar o subir el PDF', detalle: error.message });
  }
}
