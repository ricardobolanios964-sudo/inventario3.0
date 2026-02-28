// Configuration
const CONFIG = {
  inventoryURL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQFZUyjvlU7g4HUvzNfJOAJAbkEKnYwAeBnTeeiZEJrvU0_-VyTfQHHAIJqb1GO9WyBuN3TYlBmXEBG/pub?gid=1886672096&single=true&output=csv",
  appsScriptURL: "https://script.google.com/macros/s/AKfycbwfH13OxXqP11Litn-TcGyFf5m38q2S1qaaiFWy5mmeHsn_8LL5voX69Hpj0_gYeSZ92w/exec",
  cacheKey: "farmacia_bolanos_inventory_cache_v2", // Changed cache key for farmacia
  cacheExpiry: 5 * 60 * 1000, // 5 minutes
}

// State
let inventoryData = []
let currentProduct = null
let countStartTime = null
let productStartTime = null
let countId = null
let isDataLoaded = false

// Column Mapping
const columnMapping = {
  codigo: null,
  nombre: null,
}

// DOM Elements
const landingPage = document.getElementById("landing-page")
const formPage = document.getElementById("form-page")
const startCountBtn = document.getElementById("start-count-btn")
const backBtn = document.getElementById("back-btn")
const searchInput = document.getElementById("search-input")
const clearSearchBtn = document.getElementById("clear-search")
const searchResults = document.getElementById("search-results")
const productForm = document.getElementById("product-form")
const countForm = document.getElementById("count-form")
const closeFormBtn = document.getElementById("close-form")
const cancelBtn = document.getElementById("cancel-btn")
const modal = document.getElementById("modal")
const toast = document.getElementById("toast")

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners()
  loadInventoryData().then(() => {
    isDataLoaded = true
    console.log("[v0] Data loaded and ready")
  })
})

// Event Listeners
function setupEventListeners() {
  startCountBtn.addEventListener("click", startCounting)
  backBtn.addEventListener("click", goBackToLanding)
  searchInput.addEventListener("input", handleSearch)
  clearSearchBtn.addEventListener("click", clearSearch)
  closeFormBtn.addEventListener("click", closeProductForm)
  cancelBtn.addEventListener("click", handleCancel)
  countForm.addEventListener("submit", handleSubmit)

}


// Generate unique count ID
function generateCountId() {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")

  return `FARM-${year}${month}${day}-${hours}${minutes}-${random}`
}

// Start counting
function startCounting() {
  landingPage.classList.remove("active")
  formPage.classList.add("active")

  if (!isDataLoaded) {
    showDataLoadingOverlay()

    const checkInterval = setInterval(() => {
      if (isDataLoaded) {
        clearInterval(checkInterval)
        hideDataLoadingOverlay()
        searchInput.disabled = false
        searchInput.placeholder = "Buscar por código o nombre..."
        searchInput.focus()
      }
    }, 100)
  } else {
    setTimeout(() => searchInput.focus(), 300)
  }
}

// Format time
function formatTime(date) {
  return date.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

// Format date for LATAM format DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

// Load inventory data
async function loadInventoryData() {
  try {
    // Check cache first
    const cached = localStorage.getItem(CONFIG.cacheKey)
    if (cached) {
      const { data, timestamp } = JSON.parse(cached)
      const now = Date.now()

      // Use cached data if not expired
      if (now - timestamp < CONFIG.cacheExpiry) {
        inventoryData = data
        console.log("[v0] Loaded from cache:", inventoryData.length, "products")
        return
      }
    }

    // Fetch fresh data
    const response = await fetch(CONFIG.inventoryURL)
    const csvText = await response.text()
    inventoryData = parseCSV(csvText)

    // Cache the data
    localStorage.setItem(
      CONFIG.cacheKey,
      JSON.stringify({
        data: inventoryData,
        timestamp: Date.now(),
      }),
    )

    console.log("[v0] Inventory data loaded:", inventoryData.length, "products")
  } catch (error) {
    console.error("[v0] Error loading inventory:", error)
    showToast("Error al cargar el inventario", "error")
    isDataLoaded = true
  }
}

// Parse CSV
function parseCSV(csv) {
  const lines = csv.trim().split("\n")
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, "").toUpperCase())

  // Detect column names (case insensitive)
  headers.forEach((header, index) => {
    const cleanHeader = header.trim()
    if (cleanHeader.includes("CODIGO") || cleanHeader.includes("CÓDIGO") || cleanHeader === "ID") {
      columnMapping.codigo = cleanHeader
    }
    if (cleanHeader.includes("NOMBRE") || cleanHeader.includes("PRODUCTO") || cleanHeader.includes("DESCRIPCION")) {
      columnMapping.nombre = cleanHeader
    }
  })

  return lines
    .slice(1)
    .map((line) => {
      const values = parseCSVLine(line)
      const obj = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] ? values[index].trim().replace(/"/g, "") : ""
      })
      return obj
    })
    .filter((item) => {
      // Filter out empty rows
      const hasCode = columnMapping.codigo && item[columnMapping.codigo]
      const hasName = columnMapping.nombre && item[columnMapping.nombre]
      return hasCode || hasName
    })
}

// Parse CSV line (handles commas within quotes)
function parseCSVLine(line) {
  const result = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === "," && !inQuotes) {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

// Handle search
let searchTimeout = null
function handleSearch(e) {
  const query = e.target.value.trim()

  clearSearchBtn.style.display = query ? "block" : "none"

  if (query.length < 1) {
    searchResults.classList.remove("active")
    searchResults.innerHTML = ""
    return
  }

  // Debounce search for better performance
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    performSearch(query)
  }, 150)
}

function performSearch(query) {
  const normalizeText = (text) => {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
  }

  const queryNormalized = normalizeText(query)
  const queryOriginal = query.toLowerCase()

  const scoredResults = inventoryData
    .map((item) => {
      const code = getProductCode(item)
      const name = getProductName(item)
      const codeNormalized = normalizeText(code)
      const nameNormalized = normalizeText(name)
      const codeLower = code.toLowerCase()
      const nameLower = name.toLowerCase()

      let score = 0

      if (codeLower === queryOriginal || codeNormalized === queryNormalized) {
        score = 1000
      } else if (nameLower === queryOriginal || nameNormalized === queryNormalized) {
        score = 900
      } else if (codeLower.startsWith(queryOriginal) || codeNormalized.startsWith(queryNormalized)) {
        score = 800
      } else if (nameLower.startsWith(queryOriginal) || nameNormalized.startsWith(queryNormalized)) {
        score = 700
      } else if (codeNormalized.includes(queryNormalized)) {
        score = 600
      } else if (nameNormalized.includes(queryNormalized)) {
        score = 500
      } else if (fuzzyMatch(queryNormalized, codeNormalized)) {
        score = 400
      } else if (fuzzyMatch(queryNormalized, nameNormalized)) {
        score = 300
      }

      if (score > 0) {
        const lengthBonus = 100 / (code.length + name.length)
        score += lengthBonus
      }

      return { item, score }
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item)

  console.log(`[v0] Search for "${query}" returned ${scoredResults.length} results`)
  displaySearchResults(scoredResults, query)
}

// Display search results
function displaySearchResults(results, query) {
  if (results.length === 0) {
    searchResults.innerHTML = '<div class="no-results">No se encontraron productos</div>'
    searchResults.classList.add("active")
    return
  }

  const highlightText = (text, query) => {
    if (!query || !text) return text

    const normalizeText = (str) => {
      return str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
    }

    const textNormalized = normalizeText(text)
    const queryNormalized = normalizeText(query)

    const index = textNormalized.indexOf(queryNormalized)

    if (index === -1) return text

    const before = text.substring(0, index)
    const match = text.substring(index, index + query.length)
    const after = text.substring(index + query.length)

    return `${before}<span class="highlight">${match}</span>${after}`
  }

  searchResults.innerHTML = results
    .map((item) => {
      const code = getProductCode(item)
      const name = getProductName(item)

      const highlightedCode = highlightText(code, query)
      const highlightedName = highlightText(name, query)

      return `
            <div class="search-result-item" data-product='${JSON.stringify(item).replace(/'/g, "&#39;")}'>
                <div class="result-code">${highlightedCode}</div>
                <div class="result-name">${highlightedName}</div>
            </div>
        `
    })
    .join("")

  searchResults.classList.add("active")

  document.querySelectorAll(".search-result-item").forEach((item) => {
    item.addEventListener("click", () => {
      const product = JSON.parse(item.dataset.product)
      selectProduct(product)
    })
  })
}

// Clear search
function clearSearch() {
  searchInput.value = ""
  clearSearchBtn.style.display = "none"
  searchResults.classList.remove("active")
  searchResults.innerHTML = ""
  searchInput.focus()
}

// Select product
function selectProduct(product) {
  currentProduct = product
  productStartTime = new Date()

  if (!countId) {
    countId = generateCountId()
    countStartTime = new Date()

    document.getElementById("count-id").textContent = `ID: ${countId}`
    document.getElementById("start-time").textContent = `Inicio: ${formatTime(countStartTime)}`
  }

  searchResults.classList.remove("active")

  document.getElementById("product-code").textContent = getProductCode(product)
  document.getElementById("product-name").textContent = getProductName(product)

  document.getElementById("physical-count").value = ""
  document.getElementById("observations").value = ""

  productForm.style.display = "block"

  setTimeout(() => {
    productForm.scrollIntoView({ behavior: "smooth", block: "start" })
  }, 100)
}

// Close product form
function closeProductForm() {
  productForm.style.display = "none"
  currentProduct = null
  productStartTime = null
  clearSearch()
}

// Handle cancel
function handleCancel() {
  showModal("warning", "¿Cancelar registro?", "Se perderán los datos ingresados. ¿Está seguro?", () => {
    resetCountState()
    closeProductForm()
    showToast("Registro cancelado", "error")
  })
}

// Handle submit
function handleSubmit(e) {
  e.preventDefault()

  const physicalCount = document.getElementById("physical-count").value
  const observations = document.getElementById("observations").value.trim()

  showModal(
    "warning",
    "¿Enviar conteo?",
    "Confirme que los datos son correctos antes de enviar.",
    () => {
      submitCount({
        countId,
        startTime: productStartTime,
        product: currentProduct,
        physicalCount,
        observations,
      })
    }
  )
}

// Submit count
async function submitCount(data) {
  const submitTime = new Date()
  const endTime = new Date()

  // ID_REGISTRO, FECHA, HORA INCIO, HORA FIN, CODIGO, NOMBRE, CANTIDAD_FISICA, OBSERVACIONES, ESTATUS
  const countData = {
  ID_REGISTRO: data.countId,
  FECHA: formatDate(submitTime),
  "HORA INCIO": formatTime(data.startTime),
  "HORA FIN": formatTime(endTime),
  CODIGO: getProductCode(data.product),
  NOMBRE: getProductName(data.product),
  CANTIDAD_FISICA: data.physicalCount,
  OBSERVACIONES: data.observations,
  ESTATUS: "Registrado",
}

  console.log("[v0] Enviando datos a Google Sheets:", countData)

  showLoadingAnimation()

  try {
    const response = await fetch(CONFIG.appsScriptURL, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(countData),
    })

    hideLoadingAnimation()

    showModal(
      "success",
      "¡Conteo registrado!",
      `El conteo ha sido registrado exitosamente con ID: ${data.countId}`,
      () => {
        closeProductForm()
        resetCountState()
        showToast("Conteo enviado correctamente", "success")
      },
      true,
    )
  } catch (error) {
    console.error("[v0] Error al enviar conteo:", error)
    hideLoadingAnimation()
    showModal(
      "error",
      "Error al enviar",
      "No se pudo enviar el conteo a Google Sheets. Verifica tu conexión e intenta nuevamente.",
      () => {
        closeProductForm()
        resetCountState()
      },
      true,
    )
  }
}

// Show modal
function showModal(type, title, message, onConfirm, hideCancel = false) {
  const modalIcon = document.getElementById("modal-icon")
  const modalTitle = document.getElementById("modal-title")
  const modalMessage = document.getElementById("modal-message")
  const modalCancel = document.getElementById("modal-cancel")
  const modalConfirm = document.getElementById("modal-confirm")

  modalIcon.className = `modal-icon ${type}`
  modalIcon.textContent = type === "warning" ? "⚠️" : "✓"
  modalTitle.textContent = title
  modalMessage.textContent = message

  modalCancel.style.display = hideCancel ? "none" : "block"

  modal.classList.add("active")

  const handleConfirm = () => {
    modal.classList.remove("active")
    if (onConfirm) onConfirm()
    cleanup()
  }

  const handleCancel = () => {
    modal.classList.remove("active")
    cleanup()
  }

  const cleanup = () => {
    modalConfirm.removeEventListener("click", handleConfirm)
    modalCancel.removeEventListener("click", handleCancel)
  }

  modalConfirm.addEventListener("click", handleConfirm)
  modalCancel.addEventListener("click", handleCancel)
}

// Show toast
function showToast(message, type = "success") {
  toast.textContent = message
  toast.className = `toast ${type} active`

  setTimeout(() => {
    toast.classList.remove("active")
  }, 3000)
}

// Go back to landing page
function goBackToLanding() {
  showModal("warning", "¿Salir del conteo?", "Se perderá el progreso actual. ¿Está seguro?", () => {
    resetCountState()
    clearSearch()
    closeProductForm()

    document.getElementById("count-id").textContent = ""
    document.getElementById("start-time").textContent = ""

    formPage.classList.remove("active")
    landingPage.classList.add("active")

    showToast("Conteo cancelado", "error")
  })
}

function getProductCode(item) {
  if (columnMapping.codigo && item[columnMapping.codigo]) {
    return item[columnMapping.codigo]
  }
  return item.CODIGO || item.CÓDIGO || item.ID || item.CODE || "Sin código"
}

function getProductName(item) {
  if (columnMapping.nombre && item[columnMapping.nombre]) {
    return item[columnMapping.nombre]
  }
  return item.NOMBRE || item.PRODUCTO || item.DESCRIPCION || item.DESCRIPTION || "Sin nombre"
}

function fuzzyMatch(query, text) {
  let queryIndex = 0
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (text[i] === query[queryIndex]) {
      queryIndex++
    }
  }
  return queryIndex === query.length
}

// Show loading animation
function showLoadingAnimation() {
  const loadingOverlay = document.createElement("div")
  loadingOverlay.id = "loading-overlay"
  loadingOverlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p class="loading-text">Enviando conteo</p>
      <div class="loading-progress"></div>
      <p class="loading-subtext">Procesando información...</p>
    </div>
  `
  document.body.appendChild(loadingOverlay)
  setTimeout(() => loadingOverlay.classList.add("active"), 10)
}

// Hide loading animation
function hideLoadingAnimation() {
  const loadingOverlay = document.getElementById("loading-overlay")
  if (loadingOverlay) {
    loadingOverlay.classList.remove("active")
    setTimeout(() => loadingOverlay.remove(), 300)
  }
}

// Reset count state
function resetCountState() {
  countStartTime = null
  countId = null
  currentProduct = null
  productStartTime = null

  document.getElementById("physical-count").value = ""
  
  document.getElementById("observations").value = ""

  document.getElementById("count-id").textContent = ""
  document.getElementById("start-time").textContent = ""
  document.getElementById("product-code").textContent = ""
  document.getElementById("product-name").textContent = ""
}

function showDataLoadingOverlay() {
  const loadingOverlay = document.createElement("div")
  loadingOverlay.id = "data-loading-overlay"
  loadingOverlay.innerHTML = `
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <p class="loading-text">Cargando inventario farmacia</p>
      <div class="loading-progress"></div>
      <p class="loading-subtext">Preparando ${inventoryData.length || "..."} productos para búsqueda...</p>
    </div>
  `
  document.body.appendChild(loadingOverlay)
  setTimeout(() => loadingOverlay.classList.add("active"), 10)
}

function hideDataLoadingOverlay() {
  const loadingOverlay = document.getElementById("data-loading-overlay")
  if (loadingOverlay) {
    loadingOverlay.classList.remove("active")
    setTimeout(() => loadingOverlay.remove(), 300)
  }
}
