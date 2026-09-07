// --- Constantes y Configuración ---
const GRID_SIZE = 35;
const DELAY = 10; // ms por paso de animación

const TILE_EMPTY = 0;
const TILE_SHIELD = 1;
const TILE_START = 2;
const TILE_TARGET = 3;

const COST_EMPTY = 1;
const COST_SHIELD = 3;

// --- Generador de Laberinto Kruskal ---
function generateKruskalMaze(size) {
    const map = Array.from({length: size}, () => Array(size).fill(1)); // Llenar de muros
    const sets = {};
    let setId = 0;
    const edges = [];

    // Nodos (celdas impares)
    for(let y = 1; y < size - 1; y += 2) {
        for(let x = 1; x < size - 1; x += 2) {
            map[y][x] = 0; // Espacio libre
            sets[`${x},${y}`] = setId++;
            
            // Aristas posibles (derecha y abajo)
            if (x + 2 < size - 1) edges.push({x1: x, y1: y, x2: x+2, y2: y, wx: x+1, wy: y});
            if (y + 2 < size - 1) edges.push({x1: x, y1: y, x2: x, y2: y+2, wx: x, wy: y+1});
        }
    }

    // Mezclar aristas
    edges.sort(() => Math.random() - 0.5);

    for (let edge of edges) {
        const id1 = `${edge.x1},${edge.y1}`;
        const id2 = `${edge.x2},${edge.y2}`;
        
        // Find
        let root1 = sets[id1];
        while (sets[root1] !== root1) root1 = sets[root1];
        let root2 = sets[id2];
        while (sets[root2] !== root2) root2 = sets[root2];

        // Union
        if (root1 !== root2) {
            // Actualizar todos los que apuntan a root1 para que apunten a root2
            for (let key in sets) {
                if (sets[key] === root1) sets[key] = root2;
            }
            map[edge.wy][edge.wx] = 0; // Romper muro
        }
    }
    
    // Posicionar Inicio y Meta
    map[1][1] = 2; 
    map[size-2][size-2] = 3;
    // Asegurar acceso (por si la cuadrícula es par, ajustar un poco)
    map[1][2] = 0; map[2][1] = 0;
    map[size-2][size-3] = 0; map[size-3][size-2] = 0;
    
    return map;
}

// --- Generador de Escenarios (Mapas Dinámicos) ---
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
    
    // 5: Laberinto Perfecto (Kruskal)
    const map5 = generateKruskalMaze(size);
    
    return [map0, map1, map2, map3, map4, map5];
}

const maps = generateMaps(GRID_SIZE);

// --- Variables de Estado ---
let currentMap = [];
let startNode = null;
let targetNode = null;
let isRunning = false;
let abortController = null;
let currentMode = 'pathfinding'; // 'pathfinding' o 'battleship'

// Estado Batalla Naval
let battleMap = [];
let shipsTotal = 0;
let shipsHit = 0;

// Referencias DOM
const gridContainer = document.getElementById('grid-container');
const modeSelect = document.getElementById('mode-select');
const mapSelect = document.getElementById('map-select');
const algoSelect = document.getElementById('algorithm-select');
const btnStart = document.getElementById('btn-start');
const btnReset = document.getElementById('btn-reset');
const metricNodes = document.getElementById('metric-nodes');
const metricCost = document.getElementById('metric-cost');
const metricTime = document.getElementById('metric-time');
const statusMessage = document.getElementById('status-message');

const pathfindingControls = document.getElementById('pathfinding-controls');
const mapControls = document.getElementById('map-controls');
const battleshipControls = document.getElementById('battleship-controls');
const legendPathfinding = document.getElementById('legend-pathfinding');
const legendBattleship = document.getElementById('legend-battleship');
const coordInput = document.getElementById('coord-input');
const btnFire = document.getElementById('btn-fire');

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

// --- Utilidades Coordenadas ---
function getColName(n) {
    let name = '';
    while (n >= 0) {
        name = String.fromCharCode(65 + (n % 26)) + name;
        n = Math.floor(n / 26) - 1;
    }
    return name;
}

function parseCoord(coord) {
    const match = coord.toUpperCase().trim().match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    let colStr = match[1];
    let rowNum = parseInt(match[2]);
    let colNum = 0;
    for(let i=0; i<colStr.length; i++) {
        colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
    }
    colNum -= 1; // 0-based
    rowNum -= 1; // 1-based
    
    if (colNum >= 0 && colNum < GRID_SIZE && rowNum >= 0 && rowNum < GRID_SIZE) {
        return {x: colNum, y: rowNum};
    }
    return null;
}

// --- Funciones Principales ---

function init() {
    loadMap(parseInt(mapSelect.value));
    
    modeSelect.addEventListener('change', (e) => {
        currentMode = e.target.value;
        if (isRunning) stopSearch();
        
        if (currentMode === 'pathfinding') {
            pathfindingControls.classList.remove('hidden');
            mapControls.classList.remove('hidden');
            battleshipControls.classList.add('hidden');
            legendPathfinding.classList.remove('hidden');
            legendBattleship.classList.add('hidden');
            btnStart.classList.remove('hidden');
            loadMap(parseInt(mapSelect.value));
        } else {
            pathfindingControls.classList.add('hidden');
            mapControls.classList.add('hidden');
            battleshipControls.classList.remove('hidden');
            legendPathfinding.classList.add('hidden');
            legendBattleship.classList.remove('hidden');
            btnStart.classList.add('hidden');
            loadBattleship();
        }
        resetMetrics();
    });

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
        if (currentMode === 'pathfinding') {
            loadMap(parseInt(mapSelect.value));
        } else {
            loadBattleship();
        }
        resetMetrics();
        statusMessage.textContent = "LISTO";
        statusMessage.style.color = "var(--path-color)";
    });

    // Batalla Naval
    btnFire.addEventListener('click', fireBattleship);
    coordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fireBattleship();
    });
}

function renderGridHeaders() {
    gridContainer.innerHTML = '';
    // Esquina superior izquierda
    gridContainer.appendChild(document.createElement('div'));
    
    // Cabeceras Columnas (A, B, C...)
    for (let x = 0; x < GRID_SIZE; x++) {
        const header = document.createElement('div');
        header.classList.add('coord-header');
        header.textContent = getColName(x);
        gridContainer.appendChild(header);
    }
}

function createCell(x, y) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.id = `cell-${x}-${y}`;
    return cell;
}

function loadMap(mapIndex) {
    const template = maps[mapIndex];
    currentMap = [];
    gridContainer.style.setProperty('--grid-size', GRID_SIZE);
    startNode = null;
    targetNode = null;

    renderGridHeaders();

    for (let y = 0; y < GRID_SIZE; y++) {
        // Cabecera de Fila (1, 2, 3...)
        const rowHeader = document.createElement('div');
        rowHeader.classList.add('coord-header');
        rowHeader.textContent = y + 1;
        gridContainer.appendChild(rowHeader);

        let row = [];
        for (let x = 0; x < GRID_SIZE; x++) {
            const val = template[y][x];
            row.push(val);
            
            const cell = createCell(x, y);
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

// --- Batalla Naval Lógica ---
function loadBattleship() {
    battleMap = [];
    shipsTotal = 0;
    shipsHit = 0;
    gridContainer.style.setProperty('--grid-size', GRID_SIZE);
    
    renderGridHeaders();

    // Generar barcos aleatorios (5 barcos, tamaño 3)
    for (let y = 0; y < GRID_SIZE; y++) {
        battleMap.push(Array(GRID_SIZE).fill(0));
    }

    for (let i = 0; i < 5; i++) {
        let placed = false;
        while (!placed) {
            let px = Math.floor(Math.random() * (GRID_SIZE - 2));
            let py = Math.floor(Math.random() * (GRID_SIZE - 2));
            let horiz = Math.random() > 0.5;
            
            let free = true;
            for(let j=0; j<3; j++) {
                let checkX = horiz ? px+j : px;
                let checkY = horiz ? py : py+j;
                if (battleMap[checkY][checkX] !== 0) free = false;
            }

            if (free) {
                for(let j=0; j<3; j++) {
                    let setX = horiz ? px+j : px;
                    let setY = horiz ? py : py+j;
                    battleMap[setY][setX] = 1;
                    shipsTotal++;
                }
                placed = true;
            }
        }
    }

    for (let y = 0; y < GRID_SIZE; y++) {
        const rowHeader = document.createElement('div');
        rowHeader.classList.add('coord-header');
        rowHeader.textContent = y + 1;
        gridContainer.appendChild(rowHeader);

        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = createCell(x, y);
            cell.classList.add('fog'); // Niebla de guerra
            gridContainer.appendChild(cell);
        }
    }

    statusMessage.textContent = "ESPERANDO ORDENES";
    statusMessage.style.color = "var(--path-color)";
    coordInput.value = '';
    coordInput.focus();
}

function fireBattleship() {
    const val = coordInput.value;
    const coord = parseCoord(val);
    if (!coord) {
        statusMessage.textContent = "COORDENADA INVÁLIDA";
        statusMessage.style.color = "var(--ufo-color)";
        return;
    }

    const {x, y} = coord;
    const cell = document.getElementById(`cell-${x}-${y}`);
    
    // Ya disparado?
    if (cell.classList.contains('hit') || cell.classList.contains('miss')) {
        statusMessage.textContent = "YA DISPARASTE AHÍ";
        coordInput.value = '';
        return;
    }

    // Actualizar métricas
    metricNodes.textContent = parseInt(metricNodes.textContent) + 1; // Disparos
    
    if (battleMap[y][x] === 1) {
        cell.classList.remove('fog');
        cell.classList.add('hit');
        shipsHit++;
        metricCost.textContent = shipsHit + "/" + shipsTotal;
        statusMessage.textContent = "¡IMPACTO DIRECTO!";
        statusMessage.style.color = "var(--border-color)";
        
        if (shipsHit === shipsTotal) {
            statusMessage.textContent = "¡VICTORIA! FLOTA DESTRUIDA";
            statusMessage.style.color = "var(--border-color)";
        }
    } else {
        cell.classList.remove('fog');
        cell.classList.add('miss');
        statusMessage.textContent = "AGUA";
        statusMessage.style.color = "var(--path-color)";
    }
    
    coordInput.value = '';
    coordInput.focus();
}

// --- Pathfinding ---
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
    metricCost.textContent = currentMode === 'battleship' ? '0/'+shipsTotal : '0';
    metricTime.textContent = '0';
}

function stopSearch() {
    if (abortController) {
        abortController.abort();
    }
    isRunning = false;
    btnStart.disabled = false;
    mapSelect.disabled = false;
    modeSelect.disabled = false;
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
    // Arriba, Derecha, Abajo, Izquierda
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

const nodeKey = (n) => `${n.x},${n.y}`;

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
        if (parent) cost += getCost(current.x, current.y);
        current = parent;
    }
    return cost;
}

async function drawPath(path, signal) {
    for (let i = 1; i < path.length - 1; i++) {
        const node = path[i];
        document.getElementById(`cell-${node.x}-${node.y}`).classList.add('path');
        await sleep(30, signal);
    }
}

async function runSearch() {
    isRunning = true;
    btnStart.disabled = true;
    mapSelect.disabled = true;
    modeSelect.disabled = true;
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
        if (algo === 'bfs') result = await searchBFS(signal);
        else if (algo === 'dfs') result = await searchDFS(signal);
        else if (algo === 'dijkstra') result = await searchDijkstra(signal);
        else if (algo === 'greedy') result = await searchGreedy(signal);
        else if (algo === 'astar') result = await searchAStar(signal);
        else if (algo === 'backtracking') result = await searchBacktracking(signal);
        
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
        if (e.message !== 'Aborted') console.error(e);
    } finally {
        isRunning = false;
        btnStart.disabled = false;
        mapSelect.disabled = false;
        modeSelect.disabled = false;
    }
}

// --- ALGORITMOS ---

async function searchBFS(signal) {
    let nodesExpanded = 0;
    const frontier = [startNode];
    const reached = new Set();
    const parentMap = new Map();
    
    reached.add(nodeKey(startNode));
    
    while (frontier.length > 0) {
        const current = frontier.shift();
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
            if (currentMap[next.y][next.x] === 1 && false) continue; // Si los muros fueran intransitables
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

async function searchDFS(signal) {
    let nodesExpanded = 0;
    const frontier = [startNode];
    const reached = new Set();
    const parentMap = new Map();
    
    while (frontier.length > 0) {
        const current = frontier.pop();
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

// Backtracking: Variante DFS que "borra" su rastro visual al retroceder
async function searchBacktracking(signal) {
    let nodesExpanded = 0;
    const reached = new Set();
    const parentMap = new Map();
    let found = false;
    let finalTarget = null;
    
    async function backtrack(current, parent) {
        if (found) return;
        const key = nodeKey(current);
        reached.add(key);
        if (parent) parentMap.set(key, parent);

        if (current.x !== startNode.x || current.y !== startNode.y) {
            document.getElementById(`cell-${current.x}-${current.y}`).classList.add('frontier');
        }
        nodesExpanded++;
        metricNodes.textContent = nodesExpanded;
        await sleep(DELAY*2, signal);

        if (current.x === targetNode.x && current.y === targetNode.y) {
            found = true;
            finalTarget = current;
            return;
        }

        const neighbors = getNeighbors(current);
        let deadEnd = true;
        for (const next of neighbors) {
            if (!reached.has(nodeKey(next))) {
                deadEnd = false;
                await backtrack(next, current);
                if (found) return;
            }
        }
        
        // Si retrocedemos, quitar clase frontier para dar el efecto de limpieza
        if (deadEnd && current.x !== startNode.x && current.y !== startNode.y) {
            document.getElementById(`cell-${current.x}-${current.y}`).classList.remove('frontier');
            document.getElementById(`cell-${current.x}-${current.y}`).classList.add('explored'); // Lo dejamos explorado pero sin brillo
            await sleep(DELAY, signal);
        }
    }
    
    await backtrack(startNode, null);
    
    if (found) {
        return { path: reconstructPath(parentMap, finalTarget), cost: calculatePathCost(parentMap, finalTarget) };
    }
    return null;
}

// Dijkstra (A* con h=0)
async function searchDijkstra(signal) {
    let nodesExpanded = 0;
    const frontier = new PriorityQueue();
    frontier.enqueue(startNode, 0);
    const parentMap = new Map();
    const costSoFar = new Map();
    costSoFar.set(nodeKey(startNode), 0);
    
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
        
        for (const next of getNeighbors(current)) {
            const nextKey = nodeKey(next);
            const newCost = costSoFar.get(currentKey) + getCost(next.x, next.y);
            
            if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                costSoFar.set(nextKey, newCost);
                frontier.enqueue(next, newCost); // Solo usa G
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

// Greedy BFS (A* con g=0)
async function searchGreedy(signal) {
    let nodesExpanded = 0;
    const frontier = new PriorityQueue();
    frontier.enqueue(startNode, 0);
    const parentMap = new Map();
    const reached = new Set();
    reached.add(nodeKey(startNode));
    
    while (!frontier.isEmpty()) {
        const current = frontier.dequeue();
        
        if (current.x !== startNode.x || current.y !== startNode.y) {
            document.getElementById(`cell-${current.x}-${current.y}`).classList.remove('frontier');
            document.getElementById(`cell-${current.x}-${current.y}`).classList.add('explored');
        }
        nodesExpanded++;
        metricNodes.textContent = nodesExpanded;
        
        if (current.x === targetNode.x && current.y === targetNode.y) {
            return { path: reconstructPath(parentMap, current), cost: calculatePathCost(parentMap, current) };
        }
        
        for (const next of getNeighbors(current)) {
            const nextKey = nodeKey(next);
            if (!reached.has(nextKey)) {
                reached.add(nextKey);
                parentMap.set(nextKey, current);
                const priority = manhattanDistance(next, targetNode); // Solo usa H
                frontier.enqueue(next, priority);
                if (next.x !== targetNode.x || next.y !== targetNode.y) {
                    document.getElementById(`cell-${next.x}-${next.y}`).classList.add('frontier');
                }
            }
        }
        await sleep(DELAY, signal);
    }
    return null;
}

// A* (f = g + h)
async function searchAStar(signal) {
    let nodesExpanded = 0;
    const frontier = new PriorityQueue();
    frontier.enqueue(startNode, 0);
    const parentMap = new Map();
    const costSoFar = new Map();
    costSoFar.set(nodeKey(startNode), 0);
    
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
        
        for (const next of getNeighbors(current)) {
            const nextKey = nodeKey(next);
            const newCost = costSoFar.get(currentKey) + getCost(next.x, next.y);
            
            if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                costSoFar.set(nextKey, newCost);
                const priority = newCost + manhattanDistance(next, targetNode); // Usa F = G + H
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

// Inicializar
window.onload = init;
