// ========================================
// SCRIPT 3 - HISTORIAL DE PEDIDOS
// Farmacia Bolaños - Sistema de Conteo
// Optimizado para rendimiento
// ========================================

const HISTORY_CONFIG = {
  // IMPORTANTE: Cambia este gid por el de tu hoja "PEDIDOS"
  pedidosURL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFZUyjvlU7g4HUvzNfJOAJAbkEKnYwAeBnTeeiZEJrvU0_-VyTfQHHAIJqb1GO9WyBuN3TYlBmXEBG/pub?gid=693750954&single=true&output=csv",
  cacheKey: "farmacia_bolanos_pedidos_cache",
  cacheExpiry: 1000, // <-- REDUCIDO A 1 SEGUNDO PARA ACTUALIZACIÓN MÁS FRECUENTE
}

let pedidosData = []
let isPedidosLoaded = false
let isLoadingPedidos = false

const COLUMN_NAMES = {
  ID: "ID",
  FECHA_HORA: "Fecha y Hora",
  SUCURSAL: "Sucursal",
  CODIGO: "CODIGO",
  PRODUCTO: "PRODUCTO",
  LABORATORIO: "LABORATORIO",
  SOLICITUD: "SOLICITUD",
  CORREO: "Correo",
  DESPACHO: "DESPACHO",
  CANTIDAD: "CANTIDAD",
  SIN_REGISTRO: "SIN REGISTRO EN CORREO",
  FECHA: "FECHA",
  INICIO: "INICIO",
  FIN: "FIN",
  PICKER: "PICKER",
  CONTADO: "CONTADO",
  REVISADO: "REVISADO",
}

document.addEventListener("DOMContentLoaded", () => {
  setupHistoryEventListeners()
})

function setupHistoryEventListeners() {
  const viewHistoryLink = document.getElementById("view-history-link")
  const closeHistoryModal = document.getElementById("close-history-modal")
  const historyModal = document.getElementById("history-modal")

  if (viewHistoryLink) {
    viewHistoryLink.addEventListener("click", handleViewHistory)
  }

  if (closeHistoryModal) {
    closeHistoryModal.addEventListener("click", closeHistoryModalHandler)
  }

  if (historyModal) {
    historyModal.addEventListener("click", (e) => {
      if (e.target === historyModal) closeHistoryModalHandler()
    })
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && historyModal?.classList.contains("active")) {
        closeHistoryModalHandler()
      }
    },
    { passive: true },
  )
}

async function loadPedidosData() {
  if (isLoadingPedidos) return
  isLoadingPedidos = true

  try {
    const cached = localStorage.getItem(HISTORY_CONFIG.cacheKey)
    
    // <-- MODIFICADO: Validar correctamente si el caché aún es válido
    if (cached) {
      try {
        const { timestamp } = JSON.parse(cached)
        if (Date.now() - timestamp < HISTORY_CONFIG.cacheExpiry) {
          const { data } = JSON.parse(cached)
          pedidosData = data
          isPedidosLoaded = true
          isLoadingPedidos = false
          return
        }
      } catch (e) {
        console.log("[v0] Caché inválido, recargando...")
      }
    }

    const url = `${HISTORY_CONFIG.pedidosURL}&_t=${Date.now()}`
    const response = await fetch(url)
    const csvText = await response.text()

    console.log("[v0] CSV raw (primeras 500 chars):", csvText.substring(0, 500))

    pedidosData = parsePedidosCSV(csvText)
    console.log("[v0] Pedidos cargados:", pedidosData.length)

    if (pedidosData.length > 0) {
      console.log("[v0] Primer registro completo:", pedidosData[0])
      console.log("[v0] Columnas detectadas:", Object.keys(pedidosData[0]))
    }

    localStorage.setItem(
      HISTORY_CONFIG.cacheKey,
      JSON.stringify({
        data: pedidosData,
        timestamp: Date.now(),
      }),
    )

    isPedidosLoaded = true
  } catch (error) {
    console.error("[v0] Error cargando pedidos:", error)
  } finally {
    isLoadingPedidos = false
  }
}

function parsePedidosCSV(csv) {
  const lines = csv.trim().split("\n")
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

  console.log("[v0] Headers encontrados:", headers)

  const results = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj = {}

    headers.forEach((header, idx) => {
      obj[header] = values[idx] ? values[idx].trim().replace(/"/g, "") : ""
    })

    // Filtrar filas vacías
    const codigo = obj[COLUMN_NAMES.CODIGO] || obj["CODIGO"]
    if (codigo && codigo.trim()) results.push(obj)
  }

  return results
}

function parseCSVLine(line) {
  const result = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') inQuotes = !inQuotes
    else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else current += char
  }

  result.push(current)
  return result
}

const getPedidoCodigo = (item) => item[COLUMN_NAMES.CODIGO] || item["CODIGO"] || item["Codigo"] || "-"
const getPedidoProducto = (item) => item[COLUMN_NAMES.PRODUCTO] || item["PRODUCTO"] || item["Producto"] || "-"
const getPedidoFechaHora = (item) =>
  item[COLUMN_NAMES.FECHA_HORA] || item["Fecha y Hora"] || item["FECHA Y HORA"] || "-"
const getPedidoCantidad = (item) => item[COLUMN_NAMES.CANTIDAD] || item["CANTIDAD"] || item["Cantidad"] || "0"
const getPedidoDespacho = (item) => item[COLUMN_NAMES.DESPACHO] || item["DESPACHO"] || item["Despacho"] || "-"
const getPedidoSucursal = (item) => item[COLUMN_NAMES.SUCURSAL] || item["Sucursal"] || item["SUCURSAL"] || "-"
const getPedidoLaboratorio = (item) =>
  item[COLUMN_NAMES.LABORATORIO] || item["LABORATORIO"] || item["Laboratorio"] || "-"
const getPedidoSolicitud = (item) => item[COLUMN_NAMES.SOLICITUD] || item["SOLICITUD"] || item["Solicitud"] || "-"
const getPedidoPicker = (item) => item[COLUMN_NAMES.PICKER] || item["PICKER"] || item["Picker"] || "-"
const getPedidoContado = (item) => item[COLUMN_NAMES.CONTADO] || item["CONTADO"] || item["Contado"] || "-"
const getPedidoRevisado = (item) => item[COLUMN_NAMES.REVISADO] || item["REVISADO"] || item["Revisado"] || "-"
const getPedidoFecha = (item) => item[COLUMN_NAMES.FECHA] || item["FECHA"] || item["Fecha"] || "-"
const getPedidoInicio = (item) => item[COLUMN_NAMES.INICIO] || item["INICIO"] || item["Inicio"] || "-"
const getPedidoFin = (item) => item[COLUMN_NAMES.FIN] || item["FIN"] || item["Fin"] || "-"

async function handleViewHistory(e) {
  if (e) e.preventDefault()

  const productCodeElement = document.getElementById("product-code")
  if (!productCodeElement) return showHistoryToast("No hay producto seleccionado", "error")

  const productCode = productCodeElement.textContent.trim()
  if (!productCode || productCode === "Sin código") {
    return showHistoryToast("Código de producto no válido", "error")
  }

  const historyModal = document.getElementById("history-modal")
  const historyContent = document.getElementById("history-content")

  if (historyModal) {
    historyModal.classList.add("active")
    document.body.style.overflow = "hidden"
  }

  if (historyContent) {
    historyContent.innerHTML = `
      <div class="history-loading">
        <div class="history-loading-spinner"></div>
        <p>Cargando historial...</p>
      </div>
    `
  }

  // <-- MODIFICADO: Forzar recarga de datos siempre
  isPedidosLoaded = false
  await loadPedidosData()

  requestAnimationFrame(() => {
    const history = findProductHistory(productCode)
    console.log("[v0] Historial encontrado:", history.length, "registros")
    if (history.length > 0) {
      console.log("[v0] Último registro:", history[0])
    }
    displayProductHistory(productCode, history)
  })
}

function findProductHistory(code) {
  const normalizedCode = code.toString().trim().toLowerCase()
  const codigosDisponibles = pedidosData.slice(0, 10).map((item) => getPedidoCodigo(item))

  console.log("[v0] Primeros 10 códigos en pedidos:", codigosDisponibles)

  return pedidosData
    .filter((item) => {
      const itemCode = getPedidoCodigo(item).toString().trim().toLowerCase()
      return itemCode === normalizedCode
    })
    .sort((a, b) => {
      const fechaA = getPedidoFecha(a)
      const fechaB = getPedidoFecha(b)

      const parseFecha = (fecha) => {
        if (!fecha || fecha === "-") return 0
        const parts = fecha.split(/[/-]/)
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0")
          const month = parts[1].padStart(2, "0")
          const year = parts[2].length === 2 ? "20" + parts[2] : parts[2]
          return Number.parseInt(year + month + day)
        }
        return 0
      }

      const fechaNumA = parseFecha(fechaA)
      const fechaNumB = parseFecha(fechaB)

      if (fechaNumB !== fechaNumA) {
        return fechaNumB - fechaNumA
      }

      const horaA = getPedidoInicio(a) || getPedidoFechaHora(a)
      const horaB = getPedidoInicio(b) || getPedidoFechaHora(b)

      const parseHora = (hora) => {
        if (!hora || hora === "-") return 0
        const match = hora.match(/(\d{1,2}):(\d{2})/)
        if (match) {
          return Number.parseInt(match[1]) * 60 + Number.parseInt(match[2])
        }
        return 0
      }

      return parseHora(horaB) - parseHora(horaA)
    })
}

function displayProductHistory(code, history) {
  const historyContent = document.getElementById("history-content")
  if (!historyContent) return

  if (history.length === 0) {
    historyContent.innerHTML = `
      <div class="history-empty">
        <div class="history-empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
          </svg>
        </div>
        <h4>Sin historial</h4>
        <p>No se encontraron pedidos para el código <strong>${code}</strong></p>
      </div>
    `
    return
  }

  const lastRecord = history[0]
  const productName = getPedidoProducto(lastRecord)
  const fechaHora = getPedidoFechaHora(lastRecord)

  let html = `
    <div class="history-product-header">
      <span class="history-code">${code}</span>
      <h4 class="history-product-name">${productName}</h4>
      <p class="history-count">${history.length} registro${history.length > 1 ? "s" : ""} encontrado${history.length > 1 ? "s" : ""}</p>
    </div>
    <div class="history-last-record">
      <div class="history-last-header">
        <span class="history-last-badge">Último Registro</span>
      </div>
      <!-- FECHA Y HORA destacada -->
      <div class="history-datetime">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>${fechaHora}</span>
      </div>
      <div class="history-last-grid">
        <div class="history-stat-card">
          <div class="history-stat-icon cantidad">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
          </div>
          <div class="history-stat-info">
            <span class="history-stat-value">${getPedidoCantidad(lastRecord)}</span>
            <span class="history-stat-label">Cantidad</span>
          </div>
        </div>
        <div class="history-stat-card">
          <div class="history-stat-icon despacho">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div class="history-stat-info">
            <span class="history-stat-value">${getPedidoDespacho(lastRecord)}</span>
            <span class="history-stat-label">Despacho</span>
          </div>
        </div>
        <div class="history-stat-card">
          <div class="history-stat-icon sucursal">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <div class="history-stat-info">
            <span class="history-stat-value">${getPedidoSucursal(lastRecord)}</span>
            <span class="history-stat-label">Sucursal</span>
          </div>
        </div>
        <div class="history-stat-card">
          <div class="history-stat-icon laboratorio">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <div class="history-stat-info">
            <span class="history-stat-value">${getPedidoLaboratorio(lastRecord)}</span>
            <span class="history-stat-label">Laboratorio</span>
          </div>
        </div>
      </div>
      <div class="history-last-details">
        <div class="history-detail-row">
          <span class="history-detail-label">Solicitud</span>
          <span class="history-detail-value">${getPedidoSolicitud(lastRecord)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Fecha</span>
          <span class="history-detail-value">${getPedidoFecha(lastRecord)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Inicio</span>
          <span class="history-detail-value">${getPedidoInicio(lastRecord)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Fin</span>
          <span class="history-detail-value">${getPedidoFin(lastRecord)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Picker</span>
          <span class="history-detail-value">${getPedidoPicker(lastRecord)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Contado</span>
          <span class="history-detail-value">${getPedidoContado(lastRecord)}</span>
        </div>
        <div class="history-detail-row">
          <span class="history-detail-label">Revisado</span>
          <span class="history-detail-value">${getPedidoRevisado(lastRecord)}</span>
        </div>
      </div>
    </div>
  `

  if (history.length > 1) {
    html += `
      <div class="history-timeline-section">
        <h5 class="history-timeline-title">Registros Anteriores</h5>
        <div class="history-timeline">
    `

    history.forEach((record, index) => {
      html += `
        <div class="history-timeline-item ${index === 0 ? "latest" : ""}">
          <div class="history-timeline-dot"></div>
          <div class="history-timeline-content">
            <div class="history-timeline-date">${getPedidoFechaHora(record)}</div>
            <div class="history-timeline-details">
              <span>Cant: ${getPedidoCantidad(record)}</span>
              <span class="sep">•</span>
              <span>Desp: ${getPedidoDespacho(record)}</span>
              <span class="sep">•</span>
              <span>${getPedidoSucursal(record)}</span>
            </div>
          </div>
        </div>
      `
    })

    html += `</div></div>`
  }

  historyContent.innerHTML = html
}

function closeHistoryModalHandler() {
  const historyModal = document.getElementById("history-modal")
  if (historyModal) {
    historyModal.classList.remove("active")
    document.body.style.overflow = ""
  }
}

function showHistoryToast(message, type = "info") {
  const existing = document.getElementById("history-toast")
  if (existing) existing.remove()

  const toast = document.createElement("div")
  toast.id = "history-toast"
  toast.className = `history-toast ${type}`
  toast.textContent = message

  document.body.appendChild(toast)

  requestAnimationFrame(() => toast.classList.add("active"))

  setTimeout(() => {
    toast.classList.remove("active")
    setTimeout(() => toast.remove(), 200)
  }, 2500)
}

// API pública
window.historyModule = {
  refresh: () => {
    localStorage.removeItem(HISTORY_CONFIG.cacheKey)
    isPedidosLoaded = false
    return loadPedidosData()
  },
  isLoaded: () => isPedidosLoaded,
}
