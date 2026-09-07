// --- Constantes y Configuración ---
const GRID_SIZE = 35;
const DELAY = 10; // ms por paso de animación

const TILE_EMPTY = 0;
const TILE_SHIELD = 1;
const TILE_START = 2;
const TILE_TARGET = 3;

const COST_EMPTY = 1;
const COST_SHIELD = 3;

// --- Escenarios (Mapas Dinámicos) ---
function generateMaps(size) {
    const emptyMap = () => Array.from({length: size}, () => Array(size).fill(0));
    
    // 0: Nivel Básico (Bordes)
    const map0 = emptyMap();
    for(let i = 0; i < size; i++) {
        map0[i][0] = 1; map0[i][size-1] = 1;
        map0[0][i] = 1; map0[size-1][i] = 1;
    }
    map0[0][Math.floor(size/2)] = 3;
    map0[size-1][Math.floor(size/2)] = 2;
    for(let i = 10; i < size - 10; i++) {
        map0[10][i] = 1;
        map0[size-10][i] = 1;
    }
    
    // 1: Muro de Escudos
    const map1 = emptyMap();
    map1[0][Math.floor(size/2)] = 3;
    map1[size-1][Math.floor(size/2)] = 2;
    for(let row = 5; row < size - 5; row += 4) {
        for(let col = 2; col < size - 2; col++) {
            if (Math.random() > 0.15) map1[row][col] = 1;
            if (Math.random() > 0.15) map1[row+1][col] = 1;
        }
    }
    
    // 2: Laberinto Alien (Laberinto aleatorio simple)
    const map2 = emptyMap();
    map2[0][Math.floor(size/2)] = 3;
    map2[size-1][Math.floor(size/2)] = 2;
    for(let row = 2; row < size - 2; row += 2) {
        for(let col = 2; col < size - 2; col += 2) {
            map2[row][col] = 1;
            if (Math.random() > 0.5) map2[row][col+1] = 1;
            else map2[row+1][col] = 1;
        }
    }
    map2[1][Math.floor(size/2)] = 0;
    map2[size-2][Math.floor(size/2)] = 0;

    // 3: El Zig Zag
    const map3 = emptyMap();
    map3[0][Math.floor(size/2)] = 3;
    map3[size-1][Math.floor(size/2)] = 2;
    for(let row = 3; row < size - 3; row += 4) {
        for(let col = 2; col < size - 4; col++) map3[row][col] = 1;
        for(let col = 4; col < size - 2; col++) map3[row+2][col] = 1;
    }
    
    // 4: Invasión Masiva (Ruido aleatorio denso)
    const map4 = emptyMap();
    map4[0][Math.floor(size/2)] = 3;
    map4[size-1][Math.floor(size/2)] = 2;
    for(let row = 1; row < size - 1; row++) {
        for(let col = 1; col < size - 1; col++) {
            if (Math.random() > 0.65) map4[row][col] = 1;
        }
    }
    map4[1][Math.floor(size/2)] = 0; map4[2][Math.floor(size/2)] = 0;
    map4[size-2][Math.floor(size/2)] = 0; map4[size-3][Math.floor(size/2)] = 0;
    
    return [map0, map1, map2, map3, map4];
}

const maps = generateMaps(GRID_SIZE);

// --- Variables de Estado ---
let currentMap = [];
let startNode = null;
let targetNode = null;
let isRunning = false;
let abortController = null;

// Referencias DOM
const gridContainer = document.getElementById('grid-container');
const mapSelect = document.getElementById('map-select');
const algoSelect = document.getElementById('algorithm-select');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const metricNodes = document.getElementById('metric-nodes');
const metricCost = document.getElementById('metric-cost');
const metricTime = document.getElementById('metric-time');
const statusMessage = document.getElementById('status-message');

// --- Clases de Utilidad ---

class PriorityQueue {
    constructor() {
        this.elements = [];
    }
    
    enqueue(element, priority) {
        this.elements.push({ element, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }
    
    dequeue() {
        return this.elements.shift().element;
    }
    
    isEmpty() {
        return this.elements.length === 0;
    }
}

// --- Funciones Principales ---

function init() {
    loadMap(parseInt(mapSelect.value));
    
    mapSelect.addEventListener('change', (e) => {
        if (isRunning) stopSearch();
        loadMap(parseInt(e.target.value));
    });
    
    btnStart.addEventListener('click', () => {
        if (isRunning) return;
        runSearch();
    });
    
    btnReset.addEventListener('click', () => {
        if (isRunning) stopSearch();
        loadMap(parseInt(mapSelect.value));
        resetMetrics();
        statusMessage.textContent = "LISTO";
        statusMessage.style.color = "var(--path-color)";
    });
}

function loadMap(mapIndex) {
    const template = maps[mapIndex];
    currentMap = [];
    gridContainer.innerHTML = '';
    gridContainer.style.setProperty('--grid-size', GRID_SIZE);
    startNode = null;
    targetNode = null;

    for (let y = 0; y < GRID_SIZE; y++) {
        let row = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            const val = template[y][x];
            row.push(val);
            
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.id = `cell-${x}-${y}`;
            
            if (val === TILE_START) {
                cell.classList.add('ship');
                startNode = { x, y };
            } else if (val === TILE_TARGET) {
                cell.classList.add('ufo');
                targetNode = { x, y };
            } else if (val === TILE_SHIELD) {
                cell.classList.add('shield');
            } else {
                cell.classList.add('space');
            }
            
            gridContainer.appendChild(cell);
        }
        currentMap.push(row);
    }
}

function resetMapVisuals() {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.getElementById(`cell-${x}-${y}`);
            cell.classList.remove('frontier', 'explored', 'path');
        }
    }
}

function resetMetrics() {
    metricNodes.textContent = '0';
    metricCost.textContent = '0';
    metricTime.textContent = '0';
}

function stopSearch() {
    if (abortController) {
        abortController.abort();
    }
    isRunning = false;
    btnStart.disabled = false;
    mapSelect.disabled = false;
}

const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);
    if (signal) {
        signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Aborted'));
        });
    }
});

function getNeighbors(node) {
    const { x, y } = node;
    const neighbors = [];
    // Movimientos: Arriba, Derecha, Abajo, Izquierda
    const dirs = [
        { dx: 0, dy: -1 },
        { dx: 1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }
    ];
    
    for (const dir of dirs) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
            neighbors.push({ x: nx, y: ny });
        }
    }
    return neighbors;
}

function getCost(x, y) {
    return currentMap[y][x] === TILE_SHIELD ? COST_SHIELD : COST_EMPTY;
}

function manhattanDistance(nodeA, nodeB) {
    return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
}

// --- Lógica de Algoritmos ---

async function runSearch() {
    isRunning = true;
    btnStart.disabled = true;
    mapSelect.disabled = true;
    resetMapVisuals();
    resetMetrics();
    
    abortController = new AbortController();
    const signal = abortController.signal;
    const algo = algoSelect.value;
    
    statusMessage.textContent = "BUSCANDO...";
    statusMessage.style.color = "var(--frontier-color)";
    
    const startTime = performance.now();
    let result = null;
    
    try {
        if (algo === 'bfs') {
            result = await searchBFS(signal);
        } else if (algo === 'dfs') {
            result = await searchDFS(signal);
        } else if (algo === 'astar') {
            result = await searchAStar(signal);
        }
        
        const endTime = performance.now();
        metricTime.textContent = Math.round(endTime - startTime);
        
        if (result && result.path) {
            statusMessage.textContent = "¡META ALCANZADA!";
            statusMessage.style.color = "var(--border-color)";
            metricCost.textContent = result.cost;
            await drawPath(result.path, signal);
        } else {
            statusMessage.textContent = "NO HAY RUTA";
            statusMessage.style.color = "var(--ufo-color)";
        }
        
    } catch (e) {
        if (e.message !== 'Aborted') {
            console.error(e);
        }
    } finally {
        isRunning = false;
        btnStart.disabled = false;
        mapSelect.disabled = false;
    }
}

// Para generar una key de un nodo
const nodeKey = (n) => `${n.x},${n.y}`;

// Algoritmo BFS (Búsqueda en Anchura - FIFO)
// Nota: BFS estándar no considera pesos, por lo que asume costo uniforme por paso.
async function searchBFS(signal) {
    let nodesExpanded = 0;
    const frontier = [startNode];
    const reached = new Set();
    const parentMap = new Map(); // Para reconstruir la ruta
    
    reached.add(nodeKey(startNode));
    
    while (frontier.length > 0) {
        const current = frontier.shift(); // FIFO
        
        if (current.x !== startNode.x || current.y !== startNode.y) {
            document.getElementById(`cell-${current.x}-${current.y}`).classList.remove('frontier');
            document.getElementById(`cell-${current.x}-${current.y}`).classList.add('explored');
        }
        
        nodesExpanded++;
        metricNodes.textContent = nodesExpanded;
        
        if (current.x === targetNode.x && current.y === targetNode.y) {
            return { path: reconstructPath(parentMap, current), cost: calculatePathCost(parentMap, current) };
        }
        
        const neighbors = getNeighbors(current);
        for (const next of neighbors) {
            const key = nodeKey(next);
            if (!reached.has(key)) {
                reached.add(key);
                parentMap.set(key, current);
                frontier.push(next);
                
                if (next.x !== targetNode.x || next.y !== targetNode.y) {
                    document.getElementById(`cell-${next.x}-${next.y}`).classList.add('frontier');
                }
            }
        }
        
        await sleep(DELAY, signal);
    }
    return null;
}

// Algoritmo DFS (Búsqueda en Profundidad - LIFO)
async function searchDFS(signal) {
    let nodesExpanded = 0;
    const frontier = [startNode];
    const reached = new Set();
    const parentMap = new Map();
    
    while (frontier.length > 0) {
        const current = frontier.pop(); // LIFO
        const key = nodeKey(current);
        
        if (!reached.has(key)) {
            reached.add(key);
            
            if (current.x !== startNode.x || current.y !== startNode.y) {
                document.getElementById(`cell-${current.x}-${current.y}`).classList.remove('frontier');
                document.getElementById(`cell-${current.x}-${current.y}`).classList.add('explored');
            }
            
            nodesExpanded++;
            metricNodes.textContent = nodesExpanded;
            
            if (current.x === targetNode.x && current.y === targetNode.y) {
                return { path: reconstructPath(parentMap, current), cost: calculatePathCost(parentMap, current) };
            }
            
            // Para DFS, agregamos vecinos a la pila. 
            // Invertimos el orden para que la exploración parezca más natural (arriba, derecha, abajo, izq)
            const neighbors = getNeighbors(current).reverse();
            for (const next of neighbors) {
                const nextKey = nodeKey(next);
                if (!reached.has(nextKey)) {
                    parentMap.set(nextKey, current);
                    frontier.push(next);
                    if (next.x !== targetNode.x || next.y !== targetNode.y) {
                        document.getElementById(`cell-${next.x}-${next.y}`).classList.add('frontier');
                    }
                }
            }
            await sleep(DELAY, signal);
        }
    }
    return null;
}

// Algoritmo A* (f = g + h)
async function searchAStar(signal) {
    let nodesExpanded = 0;
    const frontier = new PriorityQueue();
    frontier.enqueue(startNode, 0);
    
    const parentMap = new Map();
    const costSoFar = new Map();
    
    const startKey = nodeKey(startNode);
    costSoFar.set(startKey, 0);
    
    while (!frontier.isEmpty()) {
        const current = frontier.dequeue();
        const currentKey = nodeKey(current);
        
        if (current.x !== startNode.x || current.y !== startNode.y) {
            document.getElementById(`cell-${current.x}-${current.y}`).classList.remove('frontier');
            document.getElementById(`cell-${current.x}-${current.y}`).classList.add('explored');
        }
        
        nodesExpanded++;
        metricNodes.textContent = nodesExpanded;
        
        if (current.x === targetNode.x && current.y === targetNode.y) {
            return { path: reconstructPath(parentMap, current), cost: costSoFar.get(currentKey) };
        }
        
        const neighbors = getNeighbors(current);
        for (const next of neighbors) {
            const nextKey = nodeKey(next);
            const newCost = costSoFar.get(currentKey) + getCost(next.x, next.y);
            
            if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                costSoFar.set(nextKey, newCost);
                const priority = newCost + manhattanDistance(next, targetNode);
                frontier.enqueue(next, priority);
                parentMap.set(nextKey, current);
                
                if (next.x !== targetNode.x || next.y !== targetNode.y) {
                    document.getElementById(`cell-${next.x}-${next.y}`).classList.add('frontier');
                }
            }
        }
        await sleep(DELAY, signal);
    }
    
    return null;
}

function reconstructPath(parentMap, target) {
    const path = [];
    let current = target;
    while (current) {
        path.push(current);
        current = parentMap.get(nodeKey(current));
    }
    path.reverse();
    return path;
}

function calculatePathCost(parentMap, target) {
    let cost = 0;
    let current = target;
    while (current) {
        const parent = parentMap.get(nodeKey(current));
        if (parent) {
            cost += getCost(current.x, current.y);
        }
        current = parent;
    }
    return cost;
}

async function drawPath(path, signal) {
    // No dibujar sobre inicio ni meta
    for (let i = 1; i < path.length - 1; i++) {
        const node = path[i];
        document.getElementById(`cell-${node.x}-${node.y}`).classList.add('path');
        await sleep(30, signal);
    }
}

// Inicializar
window.onload = init;
