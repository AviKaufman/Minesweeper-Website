import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

import closedTile from './assets/minesweeper/closed.svg'
import pressedTile from './assets/minesweeper/pressed.svg'
import flagSprite from './assets/minesweeper/flag.svg'
import mineSprite from './assets/minesweeper/mine.svg'
import mineRedSprite from './assets/minesweeper/mine_red.svg'
import mineWrongSprite from './assets/minesweeper/mine_wrong.svg'
import faceUnpressed from './assets/minesweeper/face_unpressed.svg'
import facePressed from './assets/minesweeper/face_pressed.svg'
import faceLose from './assets/minesweeper/face_lose.svg'
import faceWin from './assets/minesweeper/face_win.svg'
import type0 from './assets/minesweeper/nums_background.svg'
import type1 from './assets/minesweeper/type1_check.svg'
import type2 from './assets/minesweeper/type2_check.svg'
import type3 from './assets/minesweeper/type3_check.svg'
import type4 from './assets/minesweeper/type4_check.svg'
import type5 from './assets/minesweeper/type5_check.svg'
import type6 from './assets/minesweeper/type6_check.svg'
import type7 from './assets/minesweeper/type7_check.svg'
import type8 from './assets/minesweeper/type8_check.svg'
import digit0 from './assets/minesweeper/d0.svg'
import digit1 from './assets/minesweeper/d1.svg'
import digit2 from './assets/minesweeper/d2.svg'
import digit3 from './assets/minesweeper/d3.svg'
import digit4 from './assets/minesweeper/d4.svg'
import digit5 from './assets/minesweeper/d5.svg'
import digit6 from './assets/minesweeper/d6.svg'
import digit7 from './assets/minesweeper/d7.svg'
import digit8 from './assets/minesweeper/d8.svg'
import digit9 from './assets/minesweeper/d9.svg'

const difficulties = {
  beginner: { label: 'Beginner', rows: 9, cols: 9, mines: 10 },
  intermediate: { label: 'Intermediate', rows: 16, cols: 16, mines: 40 },
  expert: { label: 'Expert', rows: 16, cols: 30, mines: 99 },
}

const typeSprites = [type0, type1, type2, type3, type4, type5, type6, type7, type8]

const digitSprites = {
  '0': digit0,
  '1': digit1,
  '2': digit2,
  '3': digit3,
  '4': digit4,
  '5': digit5,
  '6': digit6,
  '7': digit7,
  '8': digit8,
  '9': digit9,
}

const defaultPreferences = {
  theme: 'system',
  accentColor: '#f5733c',
  boardTint: '#bdbdbd',
  cellSize: 32,
  showHeatmap: false,
  showHighlights: false,
  enableKeyboardNavigation: true,
  showLiveMetrics: false,
  metricsPlacement: 'below',
  tutorMode: 'off',
  tutorDepth: 3,
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

const SegmentDigit = ({ value }) => {
  const sprite = digitSprites[value]
  if (!sprite) {
    return null
  }
  return <img src={sprite} alt="" className="segment-sprite" draggable={false} />
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

const computeThreeBVProgress = (snapshot, groups) => {
  if (!groups) return 0
  let score = 0
  groups.forEach(({ cells }) => {
    const fullyRevealed = cells.every(({ row, col }) => snapshot[row][col].isRevealed)
    const fullyFlagged =
      cells.every(({ row, col }) => (snapshot[row][col].isMine ? snapshot[row][col].isFlagged : true)) &&
      cells.some(({ row, col }) => snapshot[row][col].isMine)
    if (fullyRevealed || fullyFlagged) {
      score += 1
    }
  })
  return score
}

const generateCandidateMoves = (state, mode, limit = 40) => {
  const frontier = []
  const hidden = []
  const chords = []

  state.forEach((row) =>
    row.forEach((cell) => {
      const neighbors = getNeighbors(cell.row, cell.col, state.length, state[0].length)
      if (!cell.isRevealed) {
        hidden.push({ cell, score: neighbors.filter(({ row: nr, col: nc }) => state[nr][nc].isRevealed).length })
        if (neighbors.some(({ row: nr, col: nc }) => state[nr][nc].isRevealed)) {
          frontier.push({ cell, score: neighbors.filter(({ row: nr, col: nc }) => state[nr][nc].isRevealed).length })
        }
      } else if (cell.neighborMines > 0) {
        const hiddenNeighbors = neighbors.filter(({ row: nr, col: nc }) => !state[nr][nc].isRevealed)
        if (hiddenNeighbors.length) {
          chords.push({ type: 'chord', row: cell.row, col: cell.col, score: hiddenNeighbors.length })
        }
      }
    }),
  )

  const baseSet = frontier.length ? frontier : hidden
  const sortedBase = baseSet
    .map(({ cell, score }) => ({ cell, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.cell.row !== b.cell.row) return a.cell.row - b.cell.row
      return a.cell.col - b.cell.col
    })

  const candidates = []
  sortedBase.slice(0, limit).forEach(({ cell }) => {
    candidates.push({ type: 'reveal', row: cell.row, col: cell.col })
  })

  if (mode === 'regular') {
    sortedBase
      .filter(({ cell }) => !cell.isFlagged)
      .slice(0, limit)
      .forEach(({ cell }) => candidates.push({ type: 'flag', row: cell.row, col: cell.col }))
  }

  chords
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.row !== b.row) return a.row - b.row
      return a.col - b.col
    })
    .slice(0, Math.max(30, limit))
    .forEach(({ row, col }) => candidates.push({ type: 'chord', row, col }))

  return candidates
}

const applyMoveState = (state, move) => {
  const next = cloneBoard(state)
  const descriptor = []
  const applyReveal = (row, col) => {
    const cell = next[row][col]
    descriptor.push({ type: 'reveal', row, col })
    if (cell.isFlagged || cell.isRevealed) {
      descriptor[descriptor.length - 1].note = 'ignored'
      return false
    }
    if (cell.isMine) {
      cell.isExploded = true
      descriptor[descriptor.length - 1].note = 'exploded'
      return true
    }
    floodReveal(next, row, col)
    return false
  }

  if (move.type === 'flag') {
    const cell = next[move.row][move.col]
    cell.isFlagged = !cell.isFlagged
    descriptor.push({ type: 'flag', row: move.row, col: move.col })
    return { board: next, exploded: false, descriptor }
  }

  if (move.type === 'chord') {
    const cell = next[move.row][move.col]
    descriptor.push({ type: 'chord', row: move.row, col: move.col })
    if (!cell.isRevealed) {
      descriptor[descriptor.length - 1].note = 'ignored'
      return { board: next, exploded: false, descriptor }
    }
    const neighbors = getNeighbors(move.row, move.col, next.length, next[0].length)
    const flagged = neighbors.filter(({ row, col }) => next[row][col].isFlagged).length
    if (flagged !== cell.neighborMines) {
      descriptor[descriptor.length - 1].note = 'insufficient flags'
      return { board: next, exploded: false, descriptor }
    }
    let exploded = false
    neighbors.forEach(({ row, col }) => {
      const target = next[row][col]
      if (target.isRevealed || target.isFlagged) return
      if (applyReveal(row, col)) {
        exploded = true
      }
    })
    return { board: next, exploded, descriptor }
  }

  if (applyReveal(move.row, move.col)) {
    return { board: next, exploded: true, descriptor }
  }
  return { board: next, exploded: false, descriptor }
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
  const [isFaceHeld, setIsFaceHeld] = useState(false)
  const [tutorHighlight, setTutorHighlight] = useState(null)
  const [tutorReport, setTutorReport] = useState([])
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
    setTutorHighlight(null)
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
        setIsFaceHeld(true)
        resetGame()
        setTimeout(() => setIsFaceHeld(false), 120)
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
  const tutorMode = preferences.tutorMode ?? 'off'
  const tutorDepthSetting = Math.max(1, Math.min(5, Number(preferences.tutorDepth) || 3))
  const effectiveTutorDepth =
    tutorMode === 'regular' ? tutorDepthSetting : Math.max(1, Math.min(tutorDepthSetting, 3))
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
  const tutorAnalysis = useMemo(() => {
    if (tutorMode === 'off' || status === 'won' || status === 'lost' || status === 'idle') {
      return {
        typeSets: { reveal: new Set(), flag: new Set(), chord: new Set() },
        guessCells: new Set(),
        bestGain: 0,
        report: [],
      }
    }

    const depthLimit = effectiveTutorDepth
    const groups = threeBVGroupsRef.current
    const baseline = computeThreeBVProgress(board, groups)
    const initialMoves = generateCandidateMoves(board, tutorMode, tutorMode === 'regular' ? 60 : 35)

    const guessCells = new Set(
      initialMoves.filter((move) => move.type === 'reveal').map((move) => `${move.row}-${move.col}`),
    )

    const scores = new Map()
    const exploredPaths = []

const registerGain = (move, gain, clicks, pathMoves) => {
  const key = `${move.type}-${move.row}-${move.col}`
  const prev = scores.get(key)
  if (!prev || gain > prev.bestGain || (gain === prev.bestGain && clicks < prev.moves)) {
    scores.set(key, { ...move, bestGain: gain, bestPath: pathMoves, moves: clicks })
  }
  exploredPaths.push({ path: pathMoves, gain, moves: clicks })
    }

    const explore = (state, remainingDepth, firstMove, path, clicks) => {
      if (remainingDepth === 0) return
      const nextMoves = generateCandidateMoves(state, tutorMode, 18)
      nextMoves.forEach((move) => {
        const result = applyMoveState(state, move)
        if (result.exploded) {
          exploredPaths.push({ path: [...path, ...result.descriptor], gain: -Infinity, moves: clicks + result.descriptor.length })
          return
        }
        const gain = computeThreeBVProgress(result.board, groups) - baseline
        const updatedPath = [...path, ...result.descriptor]
        const updatedClicks = clicks + result.descriptor.length
        registerGain(firstMove, gain, updatedClicks, updatedPath)
        explore(result.board, remainingDepth - 1, firstMove, updatedPath, updatedClicks)
      })
    }

    initialMoves.forEach((move) => {
      const result = applyMoveState(board, move)
      if (result.exploded) {
        exploredPaths.push({ path: result.descriptor, gain: -Infinity, moves: result.descriptor.length })
        return
      }
      const gain = computeThreeBVProgress(result.board, groups) - baseline
      registerGain(move, gain, result.descriptor.length, result.descriptor)
      if (depthLimit > 1) {
        explore(result.board, depthLimit - 1, move, result.descriptor, result.descriptor.length)
      }
    })

    const entries = Array.from(scores.values())
    const typeSets = {
      reveal: new Set(),
      flag: new Set(),
      chord: new Set(),
    }

    if (!entries.length) {
      return { typeSets, guessCells, bestGain: 0, report: exploredPaths }
    }

    const bestGain = Math.max(...entries.map((entry) => entry.bestGain))
    if (bestGain <= 0) {
      return { typeSets, guessCells, bestGain, report: exploredPaths }
    }

    const bestEntries = entries.filter((entry) => entry.bestGain === bestGain)
    const fewestMoves = Math.min(...bestEntries.map((entry) => entry.moves ?? Infinity))
    bestEntries
      .filter((entry) => (entry.moves ?? Infinity) === fewestMoves)
      .forEach((entry) => {
        typeSets[entry.type]?.add(`${entry.row}-${entry.col}`)
      })

    return { typeSets, guessCells: new Set(), bestGain, report: exploredPaths, fewestMoves }
  }, [board, tutorMode, status, preferences.tutorDepth, effectiveTutorDepth])

  const tutorTypeSets = tutorAnalysis.typeSets
  const tutorGuessCells = tutorAnalysis.guessCells

  const tutorAllowsAction = (type, row, col) => {
    if (tutorMode === 'off') return true
    const key = `${row}-${col}`
    if (tutorGuessCells.size > 0) {
      return type === 'reveal' && tutorAnalysis.guessCells.has(key)
    }
    if (tutorTypeSets.reveal.has(key)) {
      return type === 'reveal'
    }
    if (tutorTypeSets.flag.has(key)) {
      return type === 'flag'
    }
    if (tutorTypeSets.chord.has(key)) {
      return type === 'chord'
    }
    return (
      tutorTypeSets.reveal.size === 0 &&
      tutorTypeSets.flag.size === 0 &&
      tutorTypeSets.chord.size === 0
    )
  }

  useEffect(() => {
    setTutorHighlight(() => {
      if (tutorAnalysis.guessCells.size > 0) {
        return { mode: 'guess', cells: new Set(tutorAnalysis.guessCells) }
      }
      if (
        tutorTypeSets.reveal.size === 0 &&
        tutorTypeSets.flag.size === 0 &&
        tutorTypeSets.chord.size === 0
      ) {
        return null
      }
      return {
        mode: 'types',
        sets: {
          reveal: new Set(tutorTypeSets.reveal),
          flag: new Set(tutorTypeSets.flag),
          chord: new Set(tutorTypeSets.chord),
        },
      }
    })
  }, [tutorTypeSets, tutorAnalysis.guessCells])

  useEffect(() => {
    const sortedReport = (tutorAnalysis.report || []).slice().sort((a, b) => b.gain - a.gain)
    setTutorReport(sortedReport)
  }, [tutorAnalysis])

  const triggerTutorHighlight = () => {
    if (tutorGuessCells.size > 0) {
      setTutorHighlight({ mode: 'guess', cells: new Set(tutorGuessCells) })
      return
    }
    if (
      tutorTypeSets.reveal.size === 0 &&
      tutorTypeSets.flag.size === 0 &&
      tutorTypeSets.chord.size === 0
    ) {
      setTutorHighlight(null)
      return
    }
    setTutorHighlight({
      mode: 'types',
      sets: {
        reveal: new Set(tutorTypeSets.reveal),
        flag: new Set(tutorTypeSets.flag),
        chord: new Set(tutorTypeSets.chord),
      },
    })
  }

  const openTutorReport = () => {
    if (typeof window === 'undefined' || !tutorReport.length) return
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) return
    const rows = tutorReport
      .slice(0, 400)
      .map(
        ({ path, gain }, index) =>
          `<tr><td>${index + 1}</td><td>${gain.toFixed(2)}</td><td>${path
            .map((move) => `${move.type}@(${move.row + 1},${move.col + 1})`)
            .join(' → ')}</td></tr>`,
      )
      .join('')
    reportWindow.document.write(
      `<html><head><title>Efficiency Tutor Search Report</title>
      <style>body{font-family:Arial;padding:1rem;background:#111;color:#eee;}
      table{width:100%;border-collapse:collapse;}
      th,td{border:1px solid #333;padding:0.4rem;text-align:left;}
      tr:nth-child(even){background:#1e1e1e;}</style></head>
      <body><h1>Search results (depth ${effectiveTutorDepth})</h1>
      <p>Sorted by highest 3BV gain. Evaluate your own sequence below.</p>
      <form id="tutor-eval-form" style="margin-bottom:1rem;">
        <input type="text" id="tutor-eval-input" placeholder="e.g. flag@(2,3)->chord@(2,4)" style="width:70%;" />
        <button type="submit">Evaluate</button>
      </form>
      <div id="tutor-eval-result"></div>
      <table><thead><tr><th>#</th><th>3BV gain</th><th>Move sequence</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>
        const boardData = ${JSON.stringify(board)};
        const groupsData = ${JSON.stringify(
          Array.from(threeBVGroupsRef.current?.values() ?? []).map(({ cells }) => ({ cells })),
        )};
        const baseline = ${computeThreeBVProgress(board, threeBVGroupsRef.current)};
        const dirs = [-1,0,1];
        const getNeighbors = (row,col,rows,cols) => {
          const out=[];
          dirs.forEach(dr=>dirs.forEach(dc=>{
            if(dr===0 && dc===0) return;
            const nr=row+dr,nc=col+dc;
            if(nr>=0 && nr<rows && nc>=0 && nc<cols) out.push({row:nr,col:nc});
          }));
          return out;
        };
        const cloneBoard = (data) => data.map(row => row.map(cell => ({...cell})));
        const floodReveal = (state,row,col) => {
          const queue=[[row,col]];
          while(queue.length){
            const [r,c]=queue.pop();
            const cell=state[r][c];
            if(cell.isRevealed || cell.isFlagged || cell.isMine) continue;
            cell.isRevealed=true;
            if(cell.neighborMines===0){
              getNeighbors(r,c,state.length,state[0].length).forEach(({row:nr,col:nc})=>{
                if(!state[nr][nc].isRevealed && !state[nr][nc].isFlagged && !state[nr][nc].isMine){
                  queue.push([nr,nc]);
                }
              });
            }
          }
        };
        const applyMove = (board, move) => {
          const target = board[move.row][move.col];
          if(move.type==='flag'){
            target.isFlagged=!target.isFlagged;
            return { exploded:false };
          }
          if(move.type==='chord'){
            if(!target.isRevealed) return { exploded:false };
            const neighbors=getNeighbors(move.row,move.col,board.length,board[0].length);
            const flags=neighbors.filter(({row,col})=>board[row][col].isFlagged).length;
            if(flags!==target.neighborMines) return { exploded:false };
            let exploded=false;
            neighbors.forEach(({row,col})=>{
              const cell=board[row][col];
              if(cell.isRevealed || cell.isFlagged) return;
              if(cell.isMine){
                exploded=true;
                cell.isExploded=true;
              }else{
                floodReveal(board,row,col);
              }
            });
            return { exploded };
          }
          if(target.isFlagged || target.isRevealed) return { exploded:false };
          if(target.isMine){
            target.isExploded=true;
            return { exploded:true };
          }
          floodReveal(board,move.row,move.col);
          return { exploded:false };
        };
        const computeBV = (state) => {
          let count=0;
          groupsData.forEach(group=>{
            if(group.cells.some(({row,col}) => state[row][col].isRevealed && !state[row][col].isMine)){
              count+=1;
            }
          });
          return count;
        };
        const form=document.getElementById('tutor-eval-form');
        const resultEl=document.getElementById('tutor-eval-result');
        form.addEventListener('submit',(event)=>{
          event.preventDefault();
          const input=document.getElementById('tutor-eval-input').value.trim();
          if(!input){ resultEl.textContent='Enter a sequence.'; return; }
          const moves=input.split('->').map(part=>{
            const match=part.trim().match(/(reveal|flag|chord)@\\((\\d+),(\\d+)\\)/i);
            if(!match) return null;
            return { type:match[1].toLowerCase(), row:Number(match[2])-1, col:Number(match[3])-1 };
          });
          if(moves.some((m)=>!m)){ resultEl.textContent='Invalid format.'; return; }
          const state=cloneBoard(boardData);
          let exploded=false;
          moves.forEach((move)=>{
            if(exploded) return;
            const res=applyMove(state,move);
            exploded=res.exploded;
          });
          const gain=computeBV(state)-baseline;
          resultEl.textContent= exploded ? 'Sequence exploded a mine.' : '3BV gain: '+gain.toFixed(2);
        });
      </script>
      </body></html>`,
    )
    reportWindow.document.close()
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
    setIsFaceHeld(false)
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
    if (!tutorAllowsAction('reveal', row, col)) {
      triggerTutorHighlight()
      return
    }
    setTutorHighlight(null)
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
    if (!tutorAllowsAction('flag', row, col)) {
      triggerTutorHighlight()
      return
    }
    setTutorHighlight(null)
    const current = board[row][col]
    if (current.isRevealed) return
    const nextBoard = cloneBoard(board)
    nextBoard[row][col].isFlagged = !nextBoard[row][col].isFlagged
    setBoard(nextBoard)
    setActionCount((count) => count + 1)
  }

  const handleChord = (row, col) => {
    if (status === 'lost' || status === 'won') return
    if (!tutorAllowsAction('chord', row, col)) {
      triggerTutorHighlight()
      return
    }
    setTutorHighlight(null)
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
  const faceSprite =
    status === 'lost'
      ? faceLose
      : status === 'won'
        ? faceWin
        : isFaceHeld
          ? facePressed
          : faceUnpressed

  const activeDifficultyLabel = difficulty === 'custom' ? 'Custom' : difficulties[difficulty]?.label ?? 'Custom'

  const handleFaceMouseDown = () => {
    setIsFaceHeld(true)
  }

  const handleFaceMouseUp = () => {
    setIsFaceHeld(false)
    resetGame()
  }

  const handleFaceMouseLeave = () => {
    if (isFaceHeld) {
      setIsFaceHeld(false)
    }
  }

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
                className="face-button"
                onMouseDown={handleFaceMouseDown}
                onMouseUp={handleFaceMouseUp}
                onMouseLeave={handleFaceMouseLeave}
                aria-label="Restart board"
              >
                <img src={faceSprite} alt="" draggable={false} />
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
                    const isPressed =
                      !cell.isRevealed &&
                      isPointerDown &&
                      pressedCell &&
                      pressedCell.row === cell.row &&
                      pressedCell.col === cell.col

                    const showHeat = preferences.showHeatmap && cell.isRevealed && !cell.isMine
                    const heatStrength = showHeat ? Math.min(cell.neighborMines / 6, 1) : 0
                    const style = {}
                    if (showHeat) {
                      style.boxShadow = `inset 0 0 0 999px rgba(255, 99, 71, ${0.12 + heatStrength * 0.25})`
                    }

                    let tileSprite = closedTile
                    let tileAlt = 'Hidden tile'
                    if (cell.isWrongFlag) {
                      tileSprite = mineWrongSprite
                      tileAlt = 'Wrong flag'
                    } else if (cell.isRevealed) {
                      if (cell.isMine) {
                        tileSprite = cell.isExploded ? mineRedSprite : mineSprite
                        tileAlt = cell.isExploded ? 'Exploded mine' : 'Mine'
                      } else {
                        tileSprite = typeSprites[cell.neighborMines] ?? typeSprites[0]
                        tileAlt = `${cell.neighborMines} adjacent mines`
                      }
                    } else if (cell.isFlagged) {
                      tileSprite = flagSprite
                      tileAlt = 'Flagged tile'
                    } else if (isPressed) {
                      tileSprite = pressedTile
                      tileAlt = 'Pressed tile'
                    }

                    const cellKey = `${cell.row}-${cell.col}`
                    let tutorClass = ''
                    if (tutorHighlight) {
                      if (tutorHighlight.mode === 'guess' && tutorHighlight.cells.has(cellKey)) {
                        tutorClass = 'tutor-guess'
                      } else if (tutorHighlight.mode === 'types') {
                        if (tutorHighlight.sets.reveal.has(cellKey)) {
                          tutorClass = 'tutor-reveal'
                        } else if (tutorHighlight.sets.flag.has(cellKey)) {
                          tutorClass = 'tutor-flag'
                        } else if (tutorHighlight.sets.chord.has(cellKey)) {
                          tutorClass = 'tutor-chord'
                        }
                      }
                    }

                    const cellClasses = ['cell', preferences.showHighlights && isFocused ? 'focused' : '', tutorClass]

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
                        <img src={tileSprite} alt={tileAlt} draggable={false} className="tile-sprite" />
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
        {tutorMode !== 'off' && tutorHighlight && (
          <div
            className={`tutor-banner ${
              tutorHighlight.mode === 'guess' ? 'guess' : tutorHighlight.mode === 'types' ? 'multi' : ''
            }`}
          >
            {tutorHighlight.mode === 'guess' && 'Multiple efficient moves detected — choose any highlighted tile.'}
            {tutorHighlight.mode === 'types' && (
              <>
                {tutorHighlight.sets.reveal.size > 0 && <span>Reveal the blue tiles.</span>}
                {tutorHighlight.sets.flag.size > 0 && <span>Flag the red tiles.</span>}
                {tutorHighlight.sets.chord.size > 0 && <span>Chord the purple tiles.</span>}
              </>
            )}
            {tutorReport.length > 0 && (
              <button type="button" className="tutor-link" onClick={openTutorReport}>
                View search explanation
              </button>
            )}
          </div>
        )}

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
      </section>

      <section>
        <div className="section-header">
          <h2>Controls</h2>
          <p>Turn on keyboard play and customize keybinds.</p>
        </div>
        <label className="select-field">
          <span>Efficiency tutor</span>
          <select
            value={preferences.tutorMode}
            onChange={(event) => onPreferencesChange({ tutorMode: event.target.value })}
          >
            <option value="off">Off</option>
            <option value="regular">Classic (flags allowed)</option>
            <option value="noflag">No-flag</option>
          </select>
        </label>
        {preferences.tutorMode !== 'off' && (
          <label className="select-field">
            <span>Tutor depth</span>
            <input
              type="number"
              min="1"
              max="5"
              value={preferences.tutorDepth}
              onChange={(event) =>
                onPreferencesChange({
                  tutorDepth: clamp(Math.round(Number(event.target.value) || 1), 1, 5),
                })
              }
            />
          </label>
        )}
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
