import React, { useState, useEffect, useCallback, useRef } from 'react'

const API = ''

const DIFFICULTIES = ['easy','medium','hard','expert']

function pad(n) { return String(n).padStart(2,'0') }

function Timer({ running, resetKey }) {
  const [secs, setSecs] = useState(0)
  const ref = useRef()
  useEffect(() => { setSecs(0) }, [resetKey])
  useEffect(() => {
    if (running) ref.current = setInterval(() => setSecs(s => s+1), 1000)
    else clearInterval(ref.current)
    return () => clearInterval(ref.current)
  }, [running])
  const m = Math.floor(secs/60), s = secs%60
  return <span style={{fontFamily:'var(--font-mono)',fontSize:'clamp(13px,2vw,16px)',color:'var(--amber)',letterSpacing:'0.1em'}}>{pad(m)}:{pad(s)}</span>
}

const BOX_BORDERS = {
  borderTop: (r) => r === 3 || r === 6 ? '2px solid var(--amber)' : r === 0 ? '2px solid var(--amber)' : '1px solid var(--border)',
  borderLeft: (c) => c === 3 || c === 6 ? '2px solid var(--amber)' : c === 0 ? '2px solid var(--amber)' : '1px solid var(--border)',
  borderRight: (c) => c === 8 ? '2px solid var(--amber)' : '0',
  borderBottom: (r) => r === 8 ? '2px solid var(--amber)' : '0',
}

export default function App() {
  const [puzzle, setPuzzle] = useState(null)
  const [solution, setSolution] = useState(null)
  const [board, setBoard] = useState(null)
  const [given, setGiven] = useState(null)
  const [selected, setSelected] = useState(null)
  const [difficulty, setDifficulty] = useState('medium')
  const [errors, setErrors] = useState(new Set())
  const [notes, setNotes] = useState({})
  const [noteMode, setNoteMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [won, setWon] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerReset, setTimerReset] = useState(0)
  const [history, setHistory] = useState([])
  const [mistakes, setMistakes] = useState(0)
  const [highlightNum, setHighlightNum] = useState(null)

  const fetchPuzzle = useCallback(async (diff) => {
    setLoading(true)
    setWon(false)
    setErrors(new Set())
    setNotes({})
    setSelected(null)
    setHistory([])
    setMistakes(0)
    setHighlightNum(null)
    try {
      const res = await fetch(`${API}/api/puzzle?difficulty=${diff}`)
      const data = await res.json()
      setPuzzle(data.puzzle)
      setSolution(data.solution)
      const b = data.puzzle.map(r => [...r])
      setBoard(b)
      const g = new Set()
      for (let r=0;r<9;r++) for (let c=0;c<9;c++) if (data.puzzle[r][c]!==0) g.add(`${r}-${c}`)
      setGiven(g)
      setTimerReset(x => x+1)
      setTimerRunning(true)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPuzzle(difficulty) }, [])

  const handleCell = (r, c) => {
    setSelected([r,c])
    if (board[r][c] !== 0) setHighlightNum(board[r][c])
    else setHighlightNum(null)
  }

  const handleInput = useCallback((num) => {
    if (!selected || won) return
    const [r,c] = selected
    if (given && given.has(`${r}-${c}`)) return
    if (noteMode && num !== 0) {
      const key = `${r}-${c}`
      setNotes(prev => {
        const set = new Set(prev[key] || [])
        set.has(num) ? set.delete(num) : set.add(num)
        return {...prev, [key]: set}
      })
      return
    }
    setHistory(h => [...h, { r, c, val: board[r][c], notes: {...(notes[`${r}-${c}`] ? {[`${r}-${c}`]: new Set(notes[`${r}-${c}`])} : {})} }])
    const nb = board.map(row => [...row])
    nb[r][c] = num
    if (num !== 0) {
      setNotes(prev => { const n = {...prev}; delete n[`${r}-${c}`]; return n })
      setHighlightNum(num)
      if (solution && num !== solution[r][c]) {
        setErrors(e => new Set([...e, `${r}-${c}`]))
        setMistakes(m => m+1)
      } else {
        setErrors(e => { const ne = new Set(e); ne.delete(`${r}-${c}`); return ne })
      }
    } else {
      setErrors(e => { const ne = new Set(e); ne.delete(`${r}-${c}`); return ne })
      setHighlightNum(null)
    }
    setBoard(nb)
    const complete = nb.every((row,ri) => row.every((v,ci) => solution && v === solution[ri][ci]))
    if (complete) { setWon(true); setTimerRunning(false) }
  }, [selected, board, given, noteMode, notes, solution, won])

  const undo = () => {
    if (!history.length) return
    const last = history[history.length-1]
    const nb = board.map(r => [...r])
    nb[last.r][last.c] = last.val
    setBoard(nb)
    setErrors(e => { const ne = new Set(e); ne.delete(`${last.r}-${last.c}`); return ne })
    setHistory(h => h.slice(0,-1))
  }

  const reveal = () => {
    if (!selected || !solution) return
    const [r,c] = selected
    if (given && given.has(`${r}-${c}`)) return
    const nb = board.map(row => [...row])
    nb[r][c] = solution[r][c]
    setBoard(nb)
    setErrors(e => { const ne = new Set(e); ne.delete(`${r}-${c}`); return ne })
    setNotes(prev => { const n = {...prev}; delete n[`${r}-${c}`]; return n })
    setHighlightNum(solution[r][c])
    const complete = nb.every((row,ri) => row.every((v,ci) => v === solution[ri][ci]))
    if (complete) { setWon(true); setTimerRunning(false) }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key >= '1' && e.key <= '9') handleInput(parseInt(e.key))
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') handleInput(0)
      if (e.key === 'n' || e.key === 'N') setNoteMode(m => !m)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo() }
      if (selected) {
        const [r,c] = selected
        const moves = {ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}
        if (moves[e.key]) {
          const [dr,dc] = moves[e.key]
          const nr = Math.max(0,Math.min(8,r+dr)), nc = Math.max(0,Math.min(8,c+dc))
          setSelected([nr,nc])
          if (board[nr][nc] !== 0) setHighlightNum(board[nr][nc])
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleInput, selected, board, undo])

  const isHighlighted = (r,c) => {
    if (!selected) return false
    const [sr,sc] = selected
    return r===sr || c===sc || (Math.floor(r/3)===Math.floor(sr/3) && Math.floor(c/3)===Math.floor(sc/3))
  }

  const isSameNum = (r,c) => highlightNum && board && board[r][c] === highlightNum

  if (!board) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--amber)',fontFamily:'var(--font-serif)',fontSize:'2rem',letterSpacing:'0.3em'}}>LOADING…</div>

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: 'clamp(16px,4vw,40px) 16px',
      position: 'relative',
    }}>
      {/* grain overlay */}
      <div style={{
        position:'fixed',inset:0,pointerEvents:'none',zIndex:0,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        opacity: 0.6,
      }} />

      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:'520px',display:'flex',flexDirection:'column',alignItems:'center',gap:'clamp(12px,3vw,24px)'}}>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:'4px'}}>
          <h1 style={{fontFamily:'var(--font-serif)',fontSize:'clamp(2.4rem,8vw,4rem)',fontWeight:300,letterSpacing:'0.5em',color:'var(--text)',lineHeight:1,textTransform:'uppercase'}}>
            Sudoku
          </h1>
          <div style={{width:'100%',height:'1px',background:'linear-gradient(90deg,transparent,var(--amber),transparent)',marginTop:'8px'}} />
        </div>

        {/* Difficulty */}
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'center'}}>
          {DIFFICULTIES.map(d => (
            <button key={d} onClick={() => { setDifficulty(d); fetchPuzzle(d) }}
              style={{
                padding:'6px 16px',
                background: difficulty===d ? 'var(--amber)' : 'var(--surface2)',
                color: difficulty===d ? '#12100e' : 'var(--muted2)',
                border: `1px solid ${difficulty===d ? 'var(--amber)' : 'var(--border)'}`,
                borderRadius:'2px',
                fontFamily:'var(--font-mono)',
                fontSize:'10px',
                letterSpacing:'0.15em',
                textTransform:'uppercase',
                cursor:'pointer',
                transition:'all 0.2s',
                fontWeight: difficulty===d ? 700 : 400,
              }}>{d}</button>
          ))}
        </div>

        {/* Stats bar */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'10px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'2px'}}>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'9px',color:'var(--muted)',letterSpacing:'0.15em',textTransform:'uppercase'}}>Mistakes</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'18px',color: mistakes>=3?'var(--wrong)':'var(--amber)'}}>{mistakes}/3</span>
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'9px',color:'var(--muted)',letterSpacing:'0.15em',textTransform:'uppercase'}}>Time</span>
            <Timer running={timerRunning} resetKey={timerReset} />
          </div>
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'9px',color:'var(--muted)',letterSpacing:'0.15em',textTransform:'uppercase'}}>Score</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber)'}}>
              {board.flat().filter((v,i)=>v!==0&&v===solution?.flat()[i]).length}/81
            </span>
          </div>
        </div>

        {/* Board */}
        <div style={{
          display:'grid',
          gridTemplateColumns:'repeat(9,var(--cell-size))',
          gridTemplateRows:'repeat(9,var(--cell-size))',
          gap:0,
          position:'relative',
          filter: loading ? 'blur(4px) opacity(0.4)' : won ? 'none' : 'none',
          transition:'filter 0.3s',
          boxShadow: won ? '0 0 40px var(--amber-glow)' : '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          {board.map((row,r) => row.map((val,c) => {
            const key = `${r}-${c}`
            const isGiven = given && given.has(key)
            const isSelected = selected && selected[0]===r && selected[1]===c
            const isErr = errors.has(key)
            const hl = isHighlighted(r,c)
            const sameNum = isSameNum(r,c)
            const cellNotes = notes[key]

            let bg = 'var(--surface)'
            if (isSelected) bg = 'rgba(232,168,56,0.22)'
            else if (sameNum) bg = 'rgba(232,168,56,0.14)'
            else if (hl) bg = 'var(--surface2)'

            let color = isGiven ? 'var(--given)' : isErr ? 'var(--wrong)' : 'var(--amber2)'

            return (
              <div key={key}
                onClick={() => handleCell(r,c)}
                style={{
                  width:'var(--cell-size)',
                  height:'var(--cell-size)',
                  background: bg,
                  borderTop: BOX_BORDERS.borderTop(r),
                  borderLeft: BOX_BORDERS.borderLeft(c),
                  borderRight: BOX_BORDERS.borderRight(c),
                  borderBottom: BOX_BORDERS.borderBottom(r),
                  display:'flex',alignItems:'center',justifyContent:'center',
                  cursor:'pointer',
                  position:'relative',
                  transition:'background 0.12s',
                  userSelect:'none',
                  outline: isSelected ? '2px solid var(--amber)' : 'none',
                  outlineOffset: '-2px',
                  zIndex: isSelected ? 1 : 0,
                }}>
                {val !== 0 ? (
                  <span style={{
                    fontFamily:'var(--font-serif)',
                    fontSize:'clamp(18px,4.5vw,30px)',
                    fontWeight: isGiven ? 600 : 400,
                    color,
                    lineHeight:1,
                    transition:'color 0.2s',
                    animation: !isGiven && val !== 0 ? 'popIn 0.15s ease' : 'none',
                  }}>{val}</span>
                ) : cellNotes && cellNotes.size > 0 ? (
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',width:'85%',height:'85%',gap:'0'}}>
                    {[1,2,3,4,5,6,7,8,9].map(n => (
                      <span key={n} style={{
                        fontFamily:'var(--font-mono)',
                        fontSize:'clamp(5px,1.2vw,8px)',
                        color: cellNotes.has(n) ? 'var(--amber)' : 'transparent',
                        display:'flex',alignItems:'center',justifyContent:'center',
                        lineHeight:1,
                      }}>{n}</span>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          }))}
        </div>

        {/* Number pad */}
        <div style={{display:'flex',gap:'clamp(4px,1.5vw,8px)',justifyContent:'center',flexWrap:'wrap',width:'100%'}}>
          {[1,2,3,4,5,6,7,8,9].map(n => {
            const count = board.flat().filter(v=>v===n).length
            const done = count >= 9
            return (
              <button key={n}
                onClick={() => handleInput(n)}
                disabled={done}
                style={{
                  width:'clamp(36px,9vw,52px)',
                  height:'clamp(44px,11vw,64px)',
                  background: done ? 'var(--bg2)' : (highlightNum===n ? 'var(--amber-dim)' : 'var(--surface2)'),
                  border: `1px solid ${done ? 'var(--border)' : highlightNum===n ? 'var(--amber)' : 'var(--border2)'}`,
                  color: done ? 'var(--border2)' : 'var(--text)',
                  fontFamily:'var(--font-serif)',
                  fontSize:'clamp(18px,4vw,26px)',
                  fontWeight: 400,
                  cursor: done ? 'default' : 'pointer',
                  borderRadius:'2px',
                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  gap:'2px',
                  transition:'all 0.15s',
                  position:'relative',
                  overflow:'hidden',
                }}>
                {n}
                {!done && <span style={{fontFamily:'var(--font-mono)',fontSize:'7px',color:'var(--muted)',letterSpacing:'0.1em'}}>{9-count}</span>}
              </button>
            )
          })}
        </div>

        {/* Action buttons */}
        <div style={{display:'flex',gap:'8px',justifyContent:'center',flexWrap:'wrap'}}>
          {[
            { label:'Undo', icon:'↩', action: undo },
            { label:'Erase', icon:'⌫', action: () => handleInput(0) },
            { label: noteMode ? 'Notes ON' : 'Notes', icon:'✎', action: () => setNoteMode(m=>!m), active: noteMode },
            { label:'Hint', icon:'◈', action: reveal },
            { label:'New', icon:'⊕', action: () => fetchPuzzle(difficulty) },
          ].map(btn => (
            <button key={btn.label}
              onClick={btn.action}
              style={{
                padding:'8px 16px',
                background: btn.active ? 'var(--amber-dim)' : 'var(--surface)',
                border: `1px solid ${btn.active ? 'var(--amber)' : 'var(--border2)'}`,
                color: btn.active ? 'var(--amber)' : 'var(--muted2)',
                fontFamily:'var(--font-mono)',
                fontSize:'9px',
                letterSpacing:'0.15em',
                textTransform:'uppercase',
                cursor:'pointer',
                borderRadius:'2px',
                display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',
                transition:'all 0.15s',
                minWidth:'52px',
              }}>
              <span style={{fontSize:'16px'}}>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>

        {/* Keyboard hint */}
        <p style={{fontFamily:'var(--font-mono)',fontSize:'9px',color:'var(--muted)',letterSpacing:'0.12em',textAlign:'center',marginTop:'-4px'}}>
          ARROWS · 1-9 · BACKSPACE · N = NOTES · CTRL+Z = UNDO
        </p>

      </div>

      {/* Win overlay */}
      {won && (
        <div style={{
          position:'fixed',inset:0,zIndex:100,
          background:'rgba(12,10,8,0.88)',
          display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',
          gap:'24px',
          backdropFilter:'blur(8px)',
        }}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-serif)',fontSize:'clamp(3rem,12vw,7rem)',fontWeight:300,color:'var(--amber)',letterSpacing:'0.2em',lineHeight:1}}>✦</div>
            <h2 style={{fontFamily:'var(--font-serif)',fontSize:'clamp(2rem,8vw,4rem)',fontWeight:300,color:'var(--text)',letterSpacing:'0.4em',textTransform:'uppercase',marginTop:'8px'}}>Solved</h2>
            <p style={{fontFamily:'var(--font-mono)',fontSize:'11px',color:'var(--muted)',letterSpacing:'0.2em',marginTop:'12px',textTransform:'uppercase'}}>Difficulty: {difficulty} · Mistakes: {mistakes}</p>
          </div>
          <div style={{display:'flex',gap:'12px',flexWrap:'wrap',justifyContent:'center'}}>
            {DIFFICULTIES.map(d => (
              <button key={d} onClick={() => { setDifficulty(d); fetchPuzzle(d) }}
                style={{
                  padding:'10px 24px',
                  background: d===difficulty ? 'var(--amber)' : 'var(--surface2)',
                  color: d===difficulty ? '#12100e' : 'var(--muted2)',
                  border:`1px solid ${d===difficulty?'var(--amber)':'var(--border)'}`,
                  fontFamily:'var(--font-mono)',fontSize:'10px',letterSpacing:'0.15em',
                  textTransform:'uppercase',cursor:'pointer',borderRadius:'2px',fontWeight: d===difficulty?700:400,
                }}>{d}</button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        button:hover:not(:disabled) { opacity: 0.85; transform: translateY(-1px); }
        button:active:not(:disabled) { transform: translateY(0); }
      `}</style>
    </div>
  )
}
