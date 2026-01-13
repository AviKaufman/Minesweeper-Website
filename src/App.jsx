import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const difficulties = {
  beginner: { label: 'Beginner', rows: 9, cols: 9, mines: 10 },
  intermediate: { label: 'Intermediate', rows: 16, cols: 16, mines: 40 },
  expert: { label: 'Expert', rows: 16, cols: 30, mines: 99 },
}

const numberPalettes = {
  classic: ['transparent', '#0a55a6', '#0b8a2a', '#d64540', '#542ab1', '#8a3f00', '#d97e12', '#2085c0', '#5b2caf'],
  pastel: ['transparent', '#83b8ff', '#7ed69b', '#ffb8ad', '#bda4ff', '#ffdb7d', '#8ed6ff', '#f9a8d4', '#d1a5ff'],
  neon: ['transparent', '#64ffda', '#7cff8f', '#ff829c', '#c77dff', '#ffd600', '#5af2ff', '#ffa45b', '#cb6ce6'],
}

const defaultPreferences = {
  theme: 'system',
  accentColor: '#f5733c',
  boardTint: '#bdbdbd',
  cellSize: 32,
  showHeatmap: false,
  showHighlights: false,
  numberPalette: 'classic',
  enableKeyboardNavigation: true,
  showLiveMetrics: false,
  metricsPlacement: 'below',
}

const defaultKeybinds = {
  moveUp: 'ArrowUp',
  moveDown: 'ArrowDown',
  moveLeft: 'ArrowLeft',
  moveRight: 'ArrowRight',
  reveal: 'Enter',
  flag: 'f',
  chord: 'c',
  restart: 'r',
  newBoard: ' ',
  toggleFlagMode: 'Shift',
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const segmentShapes = {
  A: 'M6 2 H18 L16 5 H8 Z',
  B: 'M18 4 L21 7 V18 L18 21 L16 18 V7 Z',
  C: 'M18 21 L21 24 V35 L18 38 L16 35 V24 Z',
  D: 'M6 35 H18 L16 38 H8 Z',
  E: 'M3 21 L6 24 V35 L3 38 L1 35 V24 Z',
  F: 'M3 4 L6 7 V18 L3 21 L1 18 V7 Z',
  G: 'M6 18 H18 L16 21 H8 Z',
}

const digitSegments = {
  '0': ['A', 'B', 'C', 'D', 'E', 'F'],
  '1': ['B', 'C'],
  '2': ['A', 'B', 'G', 'E', 'D'],
  '3': ['A', 'B', 'G', 'C', 'D'],
  '4': ['F', 'G', 'B', 'C'],
  '5': ['A', 'F', 'G', 'C', 'D'],
  '6': ['A', 'F', 'G', 'C', 'D', 'E'],
  '7': ['A', 'B', 'C'],
  '8': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  '9': ['A', 'B', 'C', 'D', 'F', 'G'],
  '-': ['G'],
}

const SegmentDigit = ({ value }) => {
  const activeSegments = digitSegments[value] ?? []
  return (
    <svg viewBox="0 0 22 40" className="segment-digit" role="presentation">
      {Object.entries(segmentShapes).map(([key, path]) => (
        <path key={key} d={path} className={`segment ${activeSegments.includes(key) ? 'on' : ''}`} />
      ))}
    </svg>
  )
}

const SegmentDisplay = ({ value, ariaLabel }) => {
  const limit = 999
  const clamped = clamp(value, -limit, limit)
  const padded = Math.abs(clamped).toString().padStart(3, '0')
  const chars =
    clamped < 0 ? ['-', ...padded.slice(-2).split('')] : padded.slice(-3).split('')
  return (
    <div className="segment-display" aria-label={ariaLabel}>
      {chars.map((char, index) => (
        <SegmentDigit key={`${char}-${index}`} value={char} />
      ))}
    </div>
  )
}

const MineIcon = ({ exploded }) => (
  <svg viewBox="0 0 32 32" className={`mine-icon ${exploded ? 'exploded' : ''}`} role="presentation">
    <circle cx="16" cy="16" r="8" />
    <path d="M16 2 V8" />
    <path d="M16 24 V30" />
    <path d="M2 16 H8" />
    <path d="M24 16 H30" />
    <path d="M5 5 L10 10" />
    <path d="M22 22 L27 27" />
    <path d="M5 27 L10 22" />
    <path d="M22 10 L27 5" />
  </svg>
)

const FlagIcon = () => (
  <svg viewBox="0 0 32 32" className="flag-icon" role="presentation">
    <path d="M8 4 V28" />
    <path d="M10 5 L24 10 L10 15 Z" />
  </svg>
)

const CellNumber = ({ value, color }) => (
  <svg viewBox="0 0 28 28" className="cell-number" role="presentation">
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill={color}>
      {value}
    </text>
  </svg>
)

const formatTimeMs = (ms) => {
  const total = Math.max(0, ms || 0)
  const minutes = Math.floor(total / 60000)
  const seconds = Math.floor((total % 60000) / 1000)
  const millis = Math.floor(total % 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`
}

const prettyKey = (value) => {
  if (!value) return 'Unbound'
  if (value === ' ') return 'Space'
  if (value === 'ArrowUp') return 'Arrow ↑'
  if (value === 'ArrowDown') return 'Arrow ↓'
  if (value === 'ArrowLeft') return 'Arrow ←'
  if (value === 'ArrowRight') return 'Arrow →'
  if (value === 'Escape') return 'Esc'
  return value.length === 1 ? value.toUpperCase() : value
}

const getNeighbors = (row, col, rows, cols) => {
  const deltas = [-1, 0, 1]
  const neighbors = []
  for (const dr of deltas) {
    for (const dc of deltas) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        neighbors.push({ row: nr, col: nc })
      }
    }
  }
  return neighbors
}

const cloneBoard = (board) => board.map((row) => row.map((cell) => ({ ...cell })))

const createBoard = (rows, cols, mines, safeCell) => {
  const board = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => ({
      row,
      col,
      isMine: false,
      isFlagged: false,
      isRevealed: false,
      neighborMines: 0,
      isExploded: false,
      isWrongFlag: false,
      threeBVGroup: null,
    })),
  )

  const available = []
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (safeCell && safeCell.row === row && safeCell.col === col) {
        continue
      }
      available.push(row * cols + col)
    }
  }

  for (let i = available.length - 1; i > 0; i -= 1) {
    const swapIndex = Math.floor(Math.random() * (i + 1))
    ;[available[i], available[swapIndex]] = [available[swapIndex], available[i]]
  }

  const placements = Math.min(mines, available.length)
  for (let i = 0; i < placements; i += 1) {
    const index = available[i]
    const row = Math.floor(index / cols)
    const col = index % cols
    board[row][col].isMine = true
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (board[row][col].isMine) continue
      const adjacent = getNeighbors(row, col, rows, cols)
      board[row][col].neighborMines = adjacent.reduce(
        (count, { row: adjRow, col: adjCol }) => count + (board[adjRow][adjCol].isMine ? 1 : 0),
        0,
      )
    }
  }

  return board
}

const floodReveal = (board, startRow, startCol) => {
  const rows = board.length
  const cols = board[0].length
  const queue = [[startRow, startCol]]

  while (queue.length) {
    const [row, col] = queue.pop()
    const cell = board[row][col]
    if (cell.isRevealed || cell.isFlagged || cell.isMine) continue
    cell.isRevealed = true

    if (cell.neighborMines === 0) {
      const neighbors = getNeighbors(row, col, rows, cols)
      neighbors.forEach(({ row: nr, col: nc }) => {
        const neighbor = board[nr][nc]
        if (!neighbor.isRevealed && !neighbor.isFlagged && !neighbor.isMine) {
          queue.push([nr, nc])
        }
      })
    }
  }
}

const exposeMines = (board) => {
  for (const row of board) {
    for (const cell of row) {
      if (cell.isMine) {
        cell.isRevealed = true
      } else if (cell.isFlagged) {
        cell.isWrongFlag = true
      }
    }
  }
}

const flagAllMines = (board) => {
  for (const row of board) {
    for (const cell of row) {
      if (cell.isMine) {
        cell.isFlagged = true
        cell.isWrongFlag = false
      } else if (cell.isFlagged) {
        cell.isFlagged = false
        cell.isWrongFlag = false
      }
    }
  }
}

const hasWon = (board) =>
  board.every((row) => row.every((cell) => (cell.isMine ? true : cell.isRevealed)))

const attachThreeBVMetadata = (board) => {
  const rows = board.length
  const cols = board[0].length
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))
  const groups = new Map()
  let total = 0
  let nextId = 0

  const assignGroup = (cells) => {
    if (!cells.length) return
    const id = `g-${nextId++}`
    cells.forEach(({ row, col }) => {
      board[row][col].threeBVGroup = id
    })
    groups.set(id, { cells })
    total += 1
  }

  const exploreZeroCluster = (startRow, startCol) => {
    const stack = [[startRow, startCol]]
    const cluster = []
    visited[startRow][startCol] = true

    while (stack.length) {
      const [row, col] = stack.pop()
      const cell = board[row][col]
      cluster.push({ row, col })
      if (cell.neighborMines !== 0) continue
      const neighbors = getNeighbors(row, col, rows, cols)
      neighbors.forEach(({ row: nr, col: nc }) => {
        if (visited[nr][nc]) return
        const neighbor = board[nr][nc]
        if (neighbor.isMine) return
        visited[nr][nc] = true
        cluster.push({ row: nr, col: nc })
        if (neighbor.neighborMines === 0) {
          stack.push([nr, nc])
        }
      })
    }

    assignGroup(cluster)
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = board[row][col]
      if (cell.isMine || visited[row][col] || cell.neighborMines !== 0) continue
      exploreZeroCluster(row, col)
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = board[row][col]
      if (cell.isMine || visited[row][col]) continue
      visited[row][col] = true
      assignGroup([{ row, col }])
    }
  }

  return { board, groups, total }
}

const sanitizeBoardConfig = ({ rows, cols, mines }) => {
  const sanitizedRows = clamp(Math.round(Number(rows) || 0), 6, 30)
  const sanitizedCols = clamp(Math.round(Number(cols) || 0), 6, 30)
  const maxMines = sanitizedRows * sanitizedCols - 1
  const sanitizedMines = clamp(Math.round(Number(mines) || 0), 1, maxMines)

  return { rows: sanitizedRows, cols: sanitizedCols, mines: sanitizedMines }
}

const matchesKey = (binding, key) => {
  if (!binding) return false
  const normalizedBinding = binding.length === 1 ? binding.toLowerCase() : binding
  const normalizedKey = key.length === 1 ? key.toLowerCase() : key
  return normalizedBinding === normalizedKey
}

const KeyCaptureInput = ({ value, onChange }) => {
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (!listening) return undefined

    const handleCapture = (event) => {
      event.preventDefault()
      if (event.key === 'Escape') {
        setListening(false)
        return
      }
      const captured = event.key.length === 1 ? event.key.toLowerCase() : event.key
      onChange(captured)
      setListening(false)
    }

    window.addEventListener('keydown', handleCapture)
    return () => window.removeEventListener('keydown', handleCapture)
  }, [listening, onChange])

  return (
    <button
      type="button"
      className={`key-input ${listening ? 'listening' : ''}`}
      onClick={() => setListening(true)}
    >
      {listening ? 'Press a key…' : prettyKey(value)}
    </button>
  )
}

function App() {
  const [difficulty, setDifficulty] = useState('beginner')
  const [config, setConfig] = useState({ ...difficulties.beginner })
  const initialBoardPackageRef = useRef(null)
  if (!initialBoardPackageRef.current) {
    const base = createBoard(difficulties.beginner.rows, difficulties.beginner.cols, difficulties.beginner.mines)
    initialBoardPackageRef.current = attachThreeBVMetadata(base)
  }
  const [board, setBoard] = useState(initialBoardPackageRef.current.board)
  const [status, setStatus] = useState('idle')
  const [isFirstMove, setIsFirstMove] = useState(true)
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [keybinds, setKeybinds] = useState(defaultKeybinds)
  const [customInputs, setCustomInputs] = useState({ ...difficulties.beginner })
  const [focusedCell, setFocusedCell] = useState({ row: 0, col: 0 })
  const [flagMode, setFlagMode] = useState(false)
  const [actionCount, setActionCount] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const threeBVGroupsRef = useRef(initialBoardPackageRef.current.groups)
  const [threeBVTotal, setThreeBVTotal] = useState(initialBoardPackageRef.current.total)
  const [evaluatedThreeBV, setEvaluatedThreeBV] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [finalElapsedMs, setFinalElapsedMs] = useState(null)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const [pressedCell, setPressedCell] = useState(null)
  const timerFrameRef = useRef(null)
  const startTimeRef = useRef(null)

  const totalSafeCells = config.rows * config.cols - config.mines

  const isFlaggedTile = (row, col) => board[row]?.[col]?.isFlagged ?? false

  useEffect(() => {
    const annotated = attachThreeBVMetadata(createBoard(config.rows, config.cols, config.mines))
    threeBVGroupsRef.current = annotated.groups
    setBoard(annotated.board)
    setThreeBVTotal(annotated.total)
    setEvaluatedThreeBV(0)
    setStatus('idle')
    setElapsedMs(0)
    setFinalElapsedMs(null)
    setIsFirstMove(true)
    setFlagMode(false)
    setActionCount(0)
    startTimeRef.current = null
    if (timerFrameRef.current) {
      cancelAnimationFrame(timerFrameRef.current)
      timerFrameRef.current = null
    }
    setFocusedCell({ row: Math.floor(config.rows / 2), col: Math.floor(config.cols / 2) })
  }, [config])

  useEffect(() => {
    if (status !== 'playing') return undefined
    const tick = () => {
      if (startTimeRef.current !== null) {
        setElapsedMs(performance.now() - startTimeRef.current)
      }
      timerFrameRef.current = requestAnimationFrame(tick)
    }
    timerFrameRef.current = requestAnimationFrame(tick)
    return () => {
      if (timerFrameRef.current) {
        cancelAnimationFrame(timerFrameRef.current)
        timerFrameRef.current = null
      }
    }
  }, [status])

  useEffect(() => {
    const root = document.documentElement
    const resolvedTheme =
      preferences.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : preferences.theme

    root.dataset.theme = resolvedTheme
    root.style.setProperty('--accent-color', preferences.accentColor)
    root.style.setProperty('--board-tint', preferences.boardTint)
    root.style.setProperty('--cell-size', `${preferences.cellSize}px`)
  }, [preferences])

  useEffect(() => {
    if (preferences.theme !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [preferences.theme])

  useEffect(() => {
    const handleWindowMouseUp = () => {
      setIsPointerDown(false)
      setPressedCell(null)
    }
    window.addEventListener('mouseup', handleWindowMouseUp)
    return () => window.removeEventListener('mouseup', handleWindowMouseUp)
  }, [])

  useEffect(() => {
    if (!isPointerDown) return undefined
    const handleMove = (event) => {
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const cellButton = element?.closest?.('.cell')
      if (!cellButton) {
        setPressedCell(null)
        return
      }
      const row = Number(cellButton.dataset.row)
      const col = Number(cellButton.dataset.col)
      if (isFlaggedTile(row, col)) {
        setPressedCell(null)
        return
      }
      setPressedCell({ row, col })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [isPointerDown, board])

  useEffect(() => {
    if (!preferences.enableKeyboardNavigation) return undefined

    const handleKeyDown = (event) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key

      if (matchesKey(keybinds.restart, key)) {
        event.preventDefault()
        resetGame()
        return
      }

      if (matchesKey(keybinds.newBoard, key)) {
        event.preventDefault()
        resetGame()
        return
      }

      if (matchesKey(keybinds.toggleFlagMode, key)) {
        event.preventDefault()
        setFlagMode((prev) => !prev)
        return
      }

      if (matchesKey(keybinds.moveUp, key)) {
        event.preventDefault()
        setFocusedCell((prev) => ({ row: (prev.row - 1 + config.rows) % config.rows, col: prev.col }))
        return
      }

      if (matchesKey(keybinds.moveDown, key)) {
        event.preventDefault()
        setFocusedCell((prev) => ({ row: (prev.row + 1) % config.rows, col: prev.col }))
        return
      }

      if (matchesKey(keybinds.moveLeft, key)) {
        event.preventDefault()
        setFocusedCell((prev) => ({ row: prev.row, col: (prev.col - 1 + config.cols) % config.cols }))
        return
      }

      if (matchesKey(keybinds.moveRight, key)) {
        event.preventDefault()
        setFocusedCell((prev) => ({ row: prev.row, col: (prev.col + 1) % config.cols }))
        return
      }

      if (matchesKey(keybinds.reveal, key)) {
        event.preventDefault()
        handleReveal(focusedCell.row, focusedCell.col)
        return
      }

      if (matchesKey(keybinds.flag, key)) {
        event.preventDefault()
        handleFlag(focusedCell.row, focusedCell.col)
        return
      }

      if (matchesKey(keybinds.chord, key)) {
        event.preventDefault()
        handleChord(focusedCell.row, focusedCell.col)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [preferences.enableKeyboardNavigation, keybinds, config.rows, config.cols, focusedCell])

  const flaggedCount = useMemo(
    () => board.reduce((count, row) => count + row.filter((cell) => cell.isFlagged).length, 0),
    [board],
  )

  const revealedSafeCells = useMemo(
    () => board.reduce((count, row) => count + row.filter((cell) => cell.isRevealed && !cell.isMine).length, 0),
    [board],
  )

  const remainingMines = Math.max(0, config.mines - flaggedCount)
  const completion = totalSafeCells === 0 ? 0 : Math.round((revealedSafeCells / totalSafeCells) * 100)

  const currentPalette = numberPalettes[preferences.numberPalette] ?? numberPalettes.classic
  const effectiveTimeMs = finalElapsedMs ?? elapsedMs
  const timeSeconds = effectiveTimeMs / 1000
  const hasTime = timeSeconds > 0
  const clicksPerSecond = hasTime ? actionCount / timeSeconds : null
  const threeBVPerSecond = hasTime ? evaluatedThreeBV / timeSeconds : null
  const efficiency =
    actionCount > 0 ? (100 * evaluatedThreeBV) / actionCount : null
  const estimatedTimeSeconds =
    threeBVPerSecond && threeBVPerSecond > 0 && threeBVTotal
      ? threeBVTotal / threeBVPerSecond
      : null
  const timerSecondsDisplay = Math.floor(effectiveTimeMs / 1000)
  const shouldShowMetrics =
    threeBVTotal !== null && (preferences.showLiveMetrics || status === 'won' || status === 'lost')
  const metricsPlacement = preferences.metricsPlacement ?? 'below'
  const metricsData = {
    time: formatTimeMs(effectiveTimeMs),
    threeBV:
      threeBVTotal !== null ? `${evaluatedThreeBV}/${threeBVTotal}` : '—',
    threeBVRate: threeBVPerSecond !== null ? threeBVPerSecond.toFixed(2) : '—',
    clicks: actionCount,
    clicksRate: clicksPerSecond !== null ? clicksPerSecond.toFixed(2) : '—',
    efficiency: efficiency !== null ? `${efficiency.toFixed(1)}%` : '—',
    estimate: estimatedTimeSeconds !== null ? formatTimeMs(estimatedTimeSeconds * 1000) : '—',
  }

  const updateThreeBVProgress = (snapshot) => {
    const groups = threeBVGroupsRef.current
    if (!groups) {
      setEvaluatedThreeBV(0)
      return
    }
    let count = 0
    groups.forEach(({ cells }) => {
      if (cells.some(({ row, col }) => snapshot[row][col].isRevealed)) {
        count += 1
      }
    })
    setEvaluatedThreeBV(count)
  }

  const startRun = () => {
    startTimeRef.current = performance.now()
    setElapsedMs(0)
    setFinalElapsedMs(null)
  }

  const sealRun = () => {
    if (startTimeRef.current === null) return
    const current = performance.now() - startTimeRef.current
    setElapsedMs(current)
    setFinalElapsedMs(current)
    if (timerFrameRef.current) {
      cancelAnimationFrame(timerFrameRef.current)
      timerFrameRef.current = null
    }
  }

  const resetGame = () => {
    setConfig((prev) => ({ ...prev }))
  }

  const ensureBoardAfterFirstMove = (row, col) => {
    if (!isFirstMove) return board
    const fresh = createBoard(config.rows, config.cols, config.mines, { row, col })
    const annotated = attachThreeBVMetadata(fresh)
    threeBVGroupsRef.current = annotated.groups
    setBoard(annotated.board)
    setThreeBVTotal(annotated.total)
    setEvaluatedThreeBV(0)
    return annotated.board
  }

  const handleReveal = (row, col) => {
    if (status === 'lost' || status === 'won') return
    const currentBoard = ensureBoardAfterFirstMove(row, col)
    const nextBoard = cloneBoard(currentBoard)
    const cell = nextBoard[row][col]
    if (cell.isFlagged) return

    if (cell.isRevealed) {
      if (cell.neighborMines > 0) {
        handleChord(row, col)
      }
      return
    }

    setActionCount((count) => count + 1)

    if (isFirstMove) {
      setIsFirstMove(false)
      setStatus('playing')
      startRun()
    }

    if (cell.isMine) {
      cell.isExploded = true
      exposeMines(nextBoard)
      sealRun()
      setBoard(nextBoard)
      updateThreeBVProgress(nextBoard)
      setStatus('lost')
      return
    }

    floodReveal(nextBoard, row, col)
    const playerWon = hasWon(nextBoard)
    if (playerWon) {
      flagAllMines(nextBoard)
      sealRun()
      setStatus('won')
    } else {
      setStatus((prev) => (prev === 'idle' ? 'playing' : prev))
    }
    setBoard(nextBoard)
    updateThreeBVProgress(nextBoard)
  }

  const handleFlag = (row, col) => {
    if (status === 'lost' || status === 'won') return
    const current = board[row][col]
    if (current.isRevealed) return
    const nextBoard = cloneBoard(board)
    nextBoard[row][col].isFlagged = !nextBoard[row][col].isFlagged
    setBoard(nextBoard)
    setActionCount((count) => count + 1)
  }

  const handleChord = (row, col) => {
    if (status === 'lost' || status === 'won') return
    const target = board[row][col]
    if (target.isFlagged) return
    if (!target.isRevealed || target.neighborMines === 0) return

    const neighbors = getNeighbors(row, col, config.rows, config.cols)
    const flaggedAround = neighbors.filter(({ row: nr, col: nc }) => board[nr][nc].isFlagged).length
    if (flaggedAround !== target.neighborMines) return

    const nextBoard = cloneBoard(board)
    let triggeredMine = false

    neighbors.forEach(({ row: nr, col: nc }) => {
      const neighbor = nextBoard[nr][nc]
      if (neighbor.isFlagged) {
        if (!neighbor.isMine) {
          triggeredMine = true
        }
        return
      }
      if (neighbor.isRevealed) return
      if (neighbor.isMine) {
        neighbor.isExploded = true
        triggeredMine = true
      } else {
        floodReveal(nextBoard, nr, nc)
      }
    })

    setActionCount((count) => count + 1)

    if (triggeredMine) {
      exposeMines(nextBoard)
      sealRun()
      setBoard(nextBoard)
      updateThreeBVProgress(nextBoard)
      setStatus('lost')
      return
    }

    const playerWon = hasWon(nextBoard)
    if (playerWon) {
      flagAllMines(nextBoard)
      sealRun()
      setStatus('won')
    }
    setBoard(nextBoard)
    updateThreeBVProgress(nextBoard)
  }

  const applyDifficulty = (key) => {
    setDifficulty(key)
    const preset = difficulties[key]
    setConfig({ ...preset })
    setCustomInputs({ ...preset })
  }

  const applyCustomBoard = () => {
    const sanitized = sanitizeBoardConfig(customInputs)
    setDifficulty('custom')
    setCustomInputs(sanitized)
    setConfig(sanitized)
    setShowSettings(false)
  }

  const toggleCellAction = (row, col) => {
    const target = board[row]?.[col]
    if (target?.isRevealed && target.neighborMines > 0) {
      handleChord(row, col)
      return
    }

    if (flagMode) {
      handleFlag(row, col)
    } else {
      handleReveal(row, col)
    }
  }

  const gameStatusLabel = {
    idle: 'Ready',
    playing: 'In Progress',
    won: 'Cleared!',
    lost: 'Boom!',
  }[status]

  const statusFace = {
    idle: '🙂',
    playing: '😯',
    won: '😎',
    lost: '😵',
  }[status]

  const activeDifficultyLabel = difficulty === 'custom' ? 'Custom' : difficulties[difficulty]?.label ?? 'Custom'

  const handleCellMouseDown = (event, cell) => {
    event.preventDefault()
    if (event.button === 2) {
      handleFlag(cell.row, cell.col)
      return
    }
    if (event.button === 0) {
      if (isFlaggedTile(cell.row, cell.col)) {
        return
      }
      setIsPointerDown(true)
      setPressedCell({ row: cell.row, col: cell.col })
    }
  }

  const handleCellMouseUp = (event, cell) => {
    event.preventDefault()
    if (event.button !== 0) return
    setIsPointerDown(false)
    setPressedCell(null)
    if (event.altKey || event.metaKey) {
      handleFlag(cell.row, cell.col)
    } else {
      toggleCellAction(cell.row, cell.col)
    }
  }

  const handleCellMouseEnter = (cell) => {
    setFocusedCell({ row: cell.row, col: cell.col })

    if (isPointerDown) {
      if (isFlaggedTile(cell.row, cell.col)) {
        setPressedCell(null)
        return
      }
      setPressedCell({ row: cell.row, col: cell.col })
    }
  }

  const handleCellMouseLeave = (cell) => {
    if (
      isPointerDown &&
      pressedCell &&
      pressedCell.row === cell.row &&
      pressedCell.col === cell.col
    ) {
      setPressedCell(null)
    }
  }
  return (
    <div className="app-shell">
      <div className="toolbar">
        <div className="difficulty-switcher">
          {Object.entries(difficulties).map(([key, value]) => (
            <button
              key={key}
              type="button"
              className={`pill ${difficulty === key ? 'active' : ''}`}
              onClick={() => applyDifficulty(key)}
            >
              {value.label}
            </button>
          ))}
          <button
            type="button"
            className={`pill subtle ${difficulty === 'custom' ? 'active' : ''}`}
            onClick={() => setShowSettings(true)}
          >
            Custom…
          </button>
        </div>
        <div className="toolbar-actions">
          <button type="button" className="ghost secondary" onClick={resetGame}>
            New board
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Open settings"
            onClick={() => setShowSettings(true)}
          >
            ⚙️
          </button>
        </div>
      </div>

      <section
        className={`board-area ${
          shouldShowMetrics && metricsPlacement === 'side' ? 'side-metrics' : ''
        }`}
      >
        <div className="board-layout">
          <div className="board-chrome">
            <div className="display-bar">
              <SegmentDisplay value={remainingMines} ariaLabel="Mines remaining" />
              <button
                type="button"
                className={`status-button status-${status}`}
                onClick={resetGame}
                aria-label="Restart board"
              >
                {statusFace}
              </button>
              <SegmentDisplay value={timerSecondsDisplay} ariaLabel="Elapsed seconds" />
            </div>

            <div className="board-surface">
            <div
              className="board"
              style={{ gridTemplateColumns: `repeat(${config.cols}, var(--cell-size))` }}
            >
                {board.map((row) =>
                  row.map((cell) => {
                    const isFocused = focusedCell.row === cell.row && focusedCell.col === cell.col
                    const showHeat = preferences.showHeatmap && cell.isRevealed && !cell.isMine
                    const heatStrength = showHeat ? Math.min(cell.neighborMines / 6, 1) : 0
                    const style = {}
                    if (showHeat) {
                      style.boxShadow = `inset 0 0 0 999px rgba(255, 99, 71, ${0.12 + heatStrength * 0.25})`
                    }

                    let content = null
                    if (!cell.isRevealed && cell.isFlagged) {
                      content = <FlagIcon />
                    } else if (cell.isRevealed && cell.isMine) {
                      content = <MineIcon exploded={cell.isExploded} />
                    } else if (cell.isRevealed && cell.neighborMines > 0) {
                      const color = currentPalette[cell.neighborMines] ?? currentPalette[1]
                      content = <CellNumber value={cell.neighborMines} color={color} />
                    }

                    const isPressed =
                      !cell.isRevealed &&
                      isPointerDown &&
                      pressedCell &&
                      pressedCell.row === cell.row &&
                      pressedCell.col === cell.col

                    const cellClasses = [
                      'cell',
                      cell.isRevealed ? 'revealed' : '',
                      cell.isMine && cell.isRevealed ? 'mine' : '',
                      cell.isFlagged ? 'flagged' : '',
                      cell.isExploded ? 'exploded' : '',
                      cell.isWrongFlag ? 'wrong-flag' : '',
                      preferences.showHighlights && isFocused ? 'focused' : '',
                      isPressed ? 'pressed' : '',
                    ]

                    return (
                      <button
                        key={`${cell.row}-${cell.col}`}
                        type="button"
                        className={cellClasses.filter(Boolean).join(' ')}
                        data-row={cell.row}
                        data-col={cell.col}
                        onMouseDown={(event) => handleCellMouseDown(event, cell)}
                        onMouseUp={(event) => handleCellMouseUp(event, cell)}
                        onMouseLeave={() => handleCellMouseLeave(cell)}
                        onContextMenu={(event) => event.preventDefault()}
                        onMouseEnter={() => handleCellMouseEnter(cell)}
                        aria-label={`Row ${cell.row + 1} column ${cell.col + 1}`}
                        style={style}
                      >
                        {content}
                      </button>
                    )
                  }),
                )}
              </div>
            </div>
          </div>
          {shouldShowMetrics && metricsPlacement === 'side' && (
            <MetricsPanel placement="side" metrics={metricsData} />
          )}
        </div>

        <div className="info-row">
          <span className="chip">{activeDifficultyLabel}</span>
          <span>{config.rows} × {config.cols}</span>
          <span>{config.mines} mines</span>
          <span>{actionCount} moves</span>
          <span>{completion}% cleared</span>
          <span>Status: {gameStatusLabel}</span>
        </div>
        <div className="info-row hints">
          <button
            type="button"
            className={`ghost ${flagMode ? 'active' : ''}`}
            onClick={() => setFlagMode((prev) => !prev)}
          >
            {flagMode ? 'Flag placement' : 'Reveal mode'}
          </button>
          <span className="hint">
            Alt/⌘ click or press {prettyKey(keybinds.flag)} to flag · Click a revealed number to chord.
          </span>
        </div>
        {preferences.enableKeyboardNavigation && (
          <div className="info-row keyboard">
            <span className="hint">
              Keyboard focus → row {focusedCell.row + 1}, col {focusedCell.col + 1}
            </span>
          </div>
        )}
        {shouldShowMetrics && metricsPlacement === 'below' && (
          <MetricsPanel placement="below" metrics={metricsData} />
        )}
      </section>

      {showSettings && (
        <div
          className="settings-overlay"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowSettings(false)
            }
          }}
        >
          <SettingsPanel
            difficulty={difficulty}
            config={config}
            customInputs={customInputs}
            onCustomChange={(field, value) =>
              setCustomInputs((prev) => ({
                ...prev,
                [field]: value,
              }))
            }
            onApplyCustom={applyCustomBoard}
            onSelectDifficulty={applyDifficulty}
            preferences={preferences}
            onPreferencesChange={(next) => setPreferences((prev) => ({ ...prev, ...next }))}
            keybinds={keybinds}
            onKeybindChange={(key, value) => setKeybinds((prev) => ({ ...prev, [key]: value }))}
            onResetKeybinds={() => setKeybinds({ ...defaultKeybinds })}
            onClose={() => setShowSettings(false)}
          />
        </div>
      )}
    </div>
  )
}

const SettingsPanel = ({
  difficulty,
  config,
  customInputs,
  onCustomChange,
  onApplyCustom,
  onSelectDifficulty,
  preferences,
  onPreferencesChange,
  keybinds,
  onKeybindChange,
  onResetKeybinds,
  onClose,
}) => {
  const activeLabel = difficulty === 'custom' ? 'Custom' : difficulties[difficulty]?.label ?? 'Custom'

  return (
    <aside className="settings-panel">
      <div className="settings-header">
        <div>
          <h2>Settings</h2>
          <p>Customize the board, display, colors, and controls.</p>
        </div>
        <button type="button" className="icon-button small" onClick={onClose} aria-label="Close settings">
          ✕
        </button>
      </div>
      <section>
        <div className="section-header">
          <h2>Board</h2>
          <p>Pick a preset or craft your own challenge.</p>
        </div>
        <p className="current-config">
          Active: {config.rows} × {config.cols} with {config.mines} mines ({activeLabel})
        </p>
        <div className="difficulty-buttons">
          {Object.entries(difficulties).map(([key, value]) => (
            <button
              key={key}
              type="button"
              className={difficulty === key ? 'filled' : 'ghost'}
              onClick={() => onSelectDifficulty(key)}
            >
              {value.label}
            </button>
          ))}
        </div>
        <div className="custom-grid">
          <label>
            <span>Rows</span>
            <input
              type="number"
              min="6"
              max="30"
              value={customInputs.rows}
              onChange={(event) => onCustomChange('rows', event.target.value)}
            />
          </label>
          <label>
            <span>Columns</span>
            <input
              type="number"
              min="6"
              max="30"
              value={customInputs.cols}
              onChange={(event) => onCustomChange('cols', event.target.value)}
            />
          </label>
          <label>
            <span>Mines</span>
            <input
              type="number"
              min="1"
              max={Math.max(customInputs.rows * customInputs.cols - 1, 1)}
              value={customInputs.mines}
              onChange={(event) => onCustomChange('mines', event.target.value)}
            />
          </label>
          <button type="button" className="filled" onClick={onApplyCustom}>
            Apply & restart
          </button>
        </div>
      </section>

      <section>
        <div className="section-header">
          <h2>Display</h2>
          <p>Dial in sizing, hints, and overlays.</p>
        </div>
        <label className="slider-field">
          <span>Cell size</span>
          <input
            type="range"
            min="16"
            max="64"
            value={preferences.cellSize}
            onChange={(event) => onPreferencesChange({ cellSize: Number(event.target.value) })}
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={preferences.showHighlights}
            onChange={(event) => onPreferencesChange({ showHighlights: event.target.checked })}
          />
          <span>Show focus/highlight ring</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={preferences.showHeatmap}
            onChange={(event) => onPreferencesChange({ showHeatmap: event.target.checked })}
          />
          <span>Heat-map safe cells</span>
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={preferences.showLiveMetrics}
            onChange={(event) => onPreferencesChange({ showLiveMetrics: event.target.checked })}
          />
          <span>Show live metrics</span>
        </label>
        <label className="select-field">
          <span>Metrics placement</span>
          <select
            value={preferences.metricsPlacement}
            onChange={(event) => onPreferencesChange({ metricsPlacement: event.target.value })}
          >
            <option value="below">Below board</option>
            <option value="side">Beside board</option>
          </select>
        </label>
      </section>

      <section>
        <div className="section-header">
          <h2>Theme & colors</h2>
          <p>Match your workspace with custom colors.</p>
        </div>
        <label className="select-field">
          <span>Theme</span>
          <select
            value={preferences.theme}
            onChange={(event) => onPreferencesChange({ theme: event.target.value })}
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <div className="color-row">
          <label>
            <span>Accent</span>
            <input
              type="color"
              value={preferences.accentColor}
              onChange={(event) => onPreferencesChange({ accentColor: event.target.value })}
            />
          </label>
          <label>
            <span>Board tint</span>
            <input
              type="color"
              value={preferences.boardTint}
              onChange={(event) => onPreferencesChange({ boardTint: event.target.value })}
            />
          </label>
        </div>
        <label className="select-field">
          <span>Number palette</span>
          <select
            value={preferences.numberPalette}
            onChange={(event) => onPreferencesChange({ numberPalette: event.target.value })}
          >
            {Object.keys(numberPalettes).map((palette) => (
              <option key={palette} value={palette}>
                {palette[0].toUpperCase() + palette.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section>
        <div className="section-header">
          <h2>Controls</h2>
          <p>Turn on keyboard play and customize keybinds.</p>
        </div>
        <label className="toggle">
          <input
            type="checkbox"
            checked={preferences.enableKeyboardNavigation}
            onChange={(event) => onPreferencesChange({ enableKeyboardNavigation: event.target.checked })}
          />
          <span>Enable keyboard navigation</span>
        </label>
        <div className="keybind-grid">
          {Object.entries(keybinds).map(([key, value]) => {
            const friendly = key.replace(/([A-Z])/g, ' $1')
            const label = friendly.charAt(0).toUpperCase() + friendly.slice(1)
            return (
              <div key={key}>
                <span className="label">{label}</span>
                <KeyCaptureInput value={value} onChange={(next) => onKeybindChange(key, next)} />
              </div>
            )
          })}
        </div>
        <button type="button" className="ghost" onClick={onResetKeybinds}>
          Reset keybinds
        </button>
      </section>
    </aside>
  )
}

const MetricsPanel = ({ placement, metrics }) => {
  return (
    <div className={`metrics-panel ${placement === 'side' ? 'side' : ''}`}>
      <div>
        <span className="metric-label">Time</span>
        <span className="metric-value">{metrics.time}</span>
      </div>
      <div>
        <span className="metric-label">3BV</span>
        <span className="metric-value">{metrics.threeBV}</span>
      </div>
      <div>
        <span className="metric-label">3BV/s</span>
        <span className="metric-value">{metrics.threeBVRate}</span>
      </div>
      <div>
        <span className="metric-label">Clicks</span>
        <span className="metric-value">{metrics.clicks}</span>
      </div>
      <div>
        <span className="metric-label">Clicks/s</span>
        <span className="metric-value">{metrics.clicksRate}</span>
      </div>
      <div>
        <span className="metric-label">Efficiency</span>
        <span className="metric-value">{metrics.efficiency}</span>
      </div>
      <div>
        <span className="metric-label">Estimated time</span>
        <span className="metric-value">{metrics.estimate}</span>
      </div>
    </div>
  )
}

export default App
