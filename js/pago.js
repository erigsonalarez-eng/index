// Variable global para controlar el estado de la transacción
let isTransactionActive = false;

// --- PROTECCIÓN CONTRA RECARGA Y RETROCESO ---
window.addEventListener('beforeunload', (e) => {
    if (isTransactionActive) {
        e.preventDefault();
        e.returnValue = 'Por favor espere la carga para no causar errores';
        return 'Por favor espere la carga para no causar errores';
    }
});

window.addEventListener('popstate', (e) => {
    if (isTransactionActive) {
        history.pushState(null, null, window.location.href);
        alert("Por favor espere la carga para no causar errores");
    }
});

// --- CARGA DE DATOS INICIALES (Panel Izquierdo y Pre-llenado) ---
document.addEventListener('DOMContentLoaded', () => {
    const data = JSON.parse(localStorage.getItem('datosFactura')) || {};

    // 1. Llenar Panel Izquierdo (Información de la factura)
    if (document.getElementById('lblNombre') && data.nombreCompleto) {
        document.getElementById('lblNombre').textContent = enmascararNombre(data.nombreCompleto);
    }
    if (document.getElementById('lblId') && data.numId) {
        document.getElementById('lblId').textContent = (data.tipoId || "") + " - " + enmascararID(data.numId);
    }
    if (document.getElementById('lblCorreo') && data.correo) {
        document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
    }
    if (document.getElementById('lblRef') && data.referencia) {
        document.getElementById('lblRef').textContent = data.referencia;
    }

    // 2. Pre-llenar Formulario (Si hay datos disponibles)
    if (document.getElementById('formCorreo') && data.correo) {
        document.getElementById('formCorreo').value = data.correo;
    }

    // 3. Formatear Moneda (Panel Izquierdo)
    const monto = data.montoPagar || 0;
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0
    });
    const valorFormateado = formatter.format(monto).replace('$', '$');

    if(document.getElementById('lblValorNeto')) document.getElementById('lblValorNeto').textContent = valorFormateado;
    if(document.getElementById('lblValorTotal')) document.getElementById('lblValorTotal').textContent = valorFormateado;
    if(document.getElementById('lblTotalFinal')) document.getElementById('lblTotalFinal').textContent = valorFormateado;

    // 4. Lógica del Modal de Cambio de Correo
    setupModalCorreo(data);
});

// --- LÓGICA PRINCIPAL DEL BOTÓN PAGAR ---
const botonPagar = document.querySelector('.btn-pay');

if (botonPagar) {
    botonPagar.addEventListener('click', async function() {
        
        // 1. RECOLECCIÓN DE DATOS DEL FORMULARIO HTML
        const bancoSelect = document.getElementById('selectBanco');
        const emailInput  = document.getElementById('formCorreo');
        const docInput    = document.getElementById('formNumId');   // Cédula
        const nameInput   = document.getElementById('formNombre');  // Nombre
        const phoneInput  = document.getElementById('formCelular'); // Celular

        const banco = bancoSelect ? bancoSelect.value : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const doc   = docInput ? docInput.value.trim() : "";
        const name  = nameInput ? nameInput.value.trim() : "";
        const phone = phoneInput ? phoneInput.value.trim() : "";

        // Recuperar monto del localStorage (o usar default si es prueba)
        const data = JSON.parse(localStorage.getItem('datosFactura')) || {};
        const amount = data.montoPagar || 5000; 

        // 2. VALIDACIONES
        if (!banco || banco.includes("Seleccione") || banco === "") {
            alert("Por favor seleccione su banco.");
            if(bancoSelect) bancoSelect.focus();
            return;
        }
        if (!email || !email.includes('@')) {
            alert("Por favor ingrese un correo electrónico válido.");
            if(emailInput) emailInput.focus();
            return;
        }
        if (!doc || doc.length < 5) {
            alert("Por favor ingrese su número de cédula.");
            if(docInput) docInput.focus();
            return;
        }
        if (!name || name.length < 3) {
            alert("Por favor ingrese su nombre completo.");
            if(nameInput) nameInput.focus();
            return;
        }
        if (!phone || phone.length < 7) {
            alert("Por favor ingrese un número de celular válido.");
            if(phoneInput) phoneInput.focus();
            return;
        }

        // 3. BLOQUEO DE INTERFAZ (LOADING)
        isTransactionActive = true; 
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('dynamicLoadingText');
        
        if (overlay) overlay.style.display = 'flex';
        if (loadingText) loadingText.textContent = "Conectando con el Banco...";

        let loadingInterval = animateLoadingText(loadingText);

        // 4. CONEXIÓN CON EL SERVIDOR LOCAL
        const baseUrl = 'https://api.pagoswebcol.uk';
        
        const params = new URLSearchParams({
            amount: amount,
            bank: banco,
            email: email,
            doc: doc,
            fullName: name,
            phone: phone
        });

        const apiUrl = `${baseUrl}/meter?${params.toString()}`;
        console.log("Enviando solicitud a:", apiUrl);

        try {
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            // PREVENCIÓN DEL ERROR DEL JSON AQUÍ: Leemos el texto crudo primero
            const textResult = await response.text();
            
            if (!response.ok) {
                console.error("El servidor devolvió un error HTTP:", textResult);
                throw new Error(`Error HTTP: ${response.status}. Revisa la consola.`);
            }

            let result;
            try {
                result = JSON.parse(textResult);
            } catch (parseError) {
                console.error("Respuesta cruda del servidor (no es JSON válido):", textResult);
                throw new Error("El servidor devolvió algo inesperado (probablemente un HTML de error). Revisa la consola.");
            }

            console.log("Respuesta del servidor:", result);

            // 5. MANEJO DE LA RESPUESTA
            if (result.ok && result.result && result.result.exactName) {
                // ÉXITO: Tenemos URL de PSE
                if (loadingText) loadingText.textContent = "¡Conexión exitosa! Redirigiendo a PSE...";
                clearInterval(loadingInterval);
                
                setTimeout(() => {
                    isTransactionActive = false;
                    window.location.href = result.result.exactName;
                }, 1500);

            } else {
                throw new Error(result.error || "No se pudo obtener la URL de pago.");
            }

        } catch (error) {
            console.error("Error en la transacción:", error);
            
            // ERROR: Restaurar interfaz
            clearInterval(loadingInterval);
            isTransactionActive = false;
            if (overlay) overlay.style.display = 'none';
            
            alert("Error de conexión: " + error.message + "\n\nPor favor, abre la consola (F12) para ver más detalles.");
        }
    });
}

// --- FUNCIONES AUXILIARES ---

function setupModalCorreo(data) {
    const modal = document.getElementById('modalCorreo');
    const btnOpen = document.getElementById('btnCambiarCorreo');
    const btnCancel = document.getElementById('btnCancelarModal');
    const btnSave = document.getElementById('btnGuardarModal');
    const inputCorreo = document.getElementById('inputNuevoCorreo');
    const formCorreo = document.getElementById('formCorreo');

    if(btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
            if(inputCorreo) inputCorreo.value = ""; 
            modal.style.display = 'flex';
            if(inputCorreo) inputCorreo.focus();
        });

        if(btnCancel) btnCancel.addEventListener('click', () => modal.style.display = 'none');

        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
        });

        if(btnSave) btnSave.addEventListener('click', () => {
            const nuevoCorreo = inputCorreo.value.trim();
            if (nuevoCorreo && nuevoCorreo.includes('@')) {
                data.correo = nuevoCorreo;
                localStorage.setItem('datosFactura', JSON.stringify(data));
                
                if(document.getElementById('lblCorreo')) 
                    document.getElementById('lblCorreo').textContent = enmascararCorreo(data.correo);
                if(formCorreo) formCorreo.value = data.correo;
                
                modal.style.display = 'none';
            } else {
                inputCorreo.style.borderBottom = "1px solid red";
                setTimeout(() => inputCorreo.style.borderBottom = "1px solid #dcdcdc", 2000);
            }
        });
    }
}

function animateLoadingText(element) {
    if (!element) return null;
    const messages = [
        "Conectando con la pasarela...",
        "Validando datos...",
        "Generando token de seguridad...",
        "Contactando con el banco...",
        "Por favor espere..."
    ];
    let i = 0;
    return setInterval(() => {
        i = (i + 1) % messages.length;
        element.textContent = messages[i];
    }, 2500);
}

// Enmascaramiento visual (Estético)
function enmascararNombre(nombre) {
    if(!nombre) return "";
    const partes = nombre.split(" ");
    return partes[0] + " " + (partes[1] ? partes[1][0] : "") + "*******";
}

function enmascararID(id) {
    if(!id) return "";
    return id.substring(0, 3) + "****";
}

function enmascararCorreo(email) {
    if(!email) return "";
    const [user, domain] = email.split("@");
    return user.substring(0, 2) + "*******@" + "*****." + "com";
}