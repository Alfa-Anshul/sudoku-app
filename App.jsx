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

const BT = (r,c) => ({
  borderTop: r===0||r===3||r===6 ? '2px solid var(--amber)' : '1px solid var(--border)',
  borderLeft: c===0||c===3||c===6 ? '2px solid var(--amber)' : '1px solid var(--border)',
  borderRight: c===8 ? '2px solid var(--amber)' : '0',
  borderBottom: r===8 ? '2px solid var(--amber)' : '0',
})

export default function App() {
  const [board, setBoard] = useState(null)
  const [solution, setSolution] = useState(null)
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
    setLoading(true); setWon(false); setErrors(new Set()); setNotes({})
    setSelected(null); setHistory([]); setMistakes(0); setHighlightNum(null)
    try {
      const res = await fetch(`${API}/api/puzzle?difficulty=${diff}`)
      const data = await res.json()
      setSolution(data.solution)
      setBoard(data.puzzle.map(r => [...r]))
      const g = new Set()
      for (let r=0;r<9;r++) for (let c=0;c<9;c++) if (data.puzzle[r][c]!==0) g.add(`${r}-${c}`)
      setGiven(g)
      setTimerReset(x => x+1); setTimerRunning(true)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPuzzle('medium') }, [])

  const handleInput = useCallback((num) => {
    if (!selected || won) return
    const [r,c] = selected
    if (given && given.has(`${r}-${c}`)) return
    if (noteMode && num !== 0) {
      const key = `${r}-${c}`
      setNotes(prev => {
        const set = new Set(prev[key]||[])
        set.has(num) ? set.delete(num) : set.add(num)
        return {...prev, [key]: set}
      }); return
    }
    setHistory(h => [...h, {r, c, val: board[r][c]}])
    const nb = board.map(row => [...row]); nb[r][c] = num
    if (num !== 0) {
      setNotes(prev => { const n={...prev}; delete n[`${r}-${c}`]; return n })
      setHighlightNum(num)
      if (solution && num !== solution[r][c]) {
        setErrors(e => new Set([...e, `${r}-${c}`])); setMistakes(m => m+1)
      } else {
        setErrors(e => { const ne=new Set(e); ne.delete(`${r}-${c}`); return ne })
      }
    } else {
      setErrors(e => { const ne=new Set(e); ne.delete(`${r}-${c}`); return ne }); setHighlightNum(null)
    }
    setBoard(nb)
    if (solution && nb.every((row,ri) => row.every((v,ci) => v===solution[ri][ci]))) {
      setWon(true); setTimerRunning(false)
    }
  }, [selected, board, given, noteMode, notes, solution, won])

  const undo = useCallback(() => {
    if (!history.length) return
    const last = history[history.length-1]
    const nb = board.map(r=>[...r]); nb[last.r][last.c] = last.val
    setBoard(nb); setErrors(e=>{const ne=new Set(e);ne.delete(`${last.r}-${last.c}`);return ne})
    setHistory(h=>h.slice(0,-1))
  }, [history, board])

  const reveal = useCallback(() => {
    if (!selected || !solution) return
    const [r,c] = selected
    if (given && given.has(`${r}-${c}`)) return
    const nb = board.map(row=>[...row]); nb[r][c] = solution[r][c]
    setBoard(nb); setErrors(e=>{const ne=new Set(e);ne.delete(`${r}-${c}`);return ne})
    setNotes(prev=>{const n={...prev};delete n[`${r}-${c}`];return n})
    setHighlightNum(solution[r][c])
    if (nb.every((row,ri)=>row.every((v,ci)=>v===solution[ri][ci]))) { setWon(true); setTimerRunning(false) }
  }, [selected, solution, board, given])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key>='1'&&e.key<='9') handleInput(parseInt(e.key))
      if (e.key==='Backspace'||e.key==='Delete'||e.key==='0') handleInput(0)
      if (e.key==='n'||e.key==='N') setNoteMode(m=>!m)
      if ((e.ctrlKey||e.metaKey)&&e.key==='z') { e.preventDefault(); undo() }
      if (selected) {
        const [r,c]=selected, mv={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}
        if (mv[e.key]) { const [dr,dc]=mv[e.key]; setSelected([Math.max(0,Math.min(8,r+dr)),Math.max(0,Math.min(8,c+dc))]) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleInput, selected, undo])

  const isHL = (r,c) => {
    if (!selected) return false
    const [sr,sc]=selected
    return r===sr||c===sc||(Math.floor(r/3)===Math.floor(sr/3)&&Math.floor(c/3)===Math.floor(sc/3))
  }

  if (!board) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--amber)',fontFamily:'var(--font-serif)',fontSize:'2rem',letterSpacing:'0.3em'}}>LOADING…</div>

  const solvedCount = board.flat().filter((v,i)=>v!==0&&v===solution?.flat()[i]).length

  return (
    <div style={{minHeight:'100vh',background:'var(--bg)',display:'flex',flexDirection:'column',alignItems:'center',padding:'clamp(16px,4vw,40px) 16px',position:'relative'}}>
      <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,opacity:0.5,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E")`}} />
      <div style={{position:'relative',zIndex:1,width:'100%',maxWidth:'520px',display:'flex',flexDirection:'column',alignItems:'center',gap:'clamp(10px,2.5vw,20px)'}}>

        <div style={{textAlign:'center',marginBottom:'4px'}}>
          <h1 style={{fontFamily:'var(--font-serif)',fontSize:'clamp(2.2rem,7vw,3.8rem)',fontWeight:300,letterSpacing:'0.5em',color:'var(--text)',textTransform:'uppercase',lineHeight:1}}>Sudoku</h1>
          <div style={{height:'1px',background:'linear-gradient(90deg,transparent,var(--amber),transparent)',marginTop:'8px'}} />
        </div>

        <div style={{display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'center'}}>
          {DIFFICULTIES.map(d => (
            <button key={d} onClick={() => { setDifficulty(d); fetchPuzzle(d) }} style={{
              padding:'5px 14px',borderRadius:'2px',cursor:'pointer',transition:'all 0.2s',
              background:difficulty===d?'var(--amber)':'var(--surface2)',
              color:difficulty===d?'#12100e':'var(--muted2)',
              border:`1px solid ${difficulty===d?'var(--amber)':'var(--border)'}`,
              fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'0.15em',textTransform:'uppercase',
              fontWeight:difficulty===d?700:400,
            }}>{d}</button>
          ))}
        </div>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'10px 16px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'2px'}}>
          {[{label:'Mistakes',val:<span style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:mistakes>=3?'var(--wrong)':'var(--amber)'}}>{mistakes}/3</span>},
            {label:'Time',val:<Timer running={timerRunning} resetKey={timerReset} />},
            {label:'Progress',val:<span style={{fontFamily:'var(--font-mono)',fontSize:'18px',color:'var(--amber)'}}>{solvedCount}/81</span>},
          ].map(({label,val}) => (
            <div key={label} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:'8px',color:'var(--muted)',letterSpacing:'0.15em',textTransform:'uppercase'}}>{label}</span>
              {val}
            </div>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(9,var(--cell-size))',gridTemplateRows:'repeat(9,var(--cell-size))',
          filter:loading?'blur(4px) opacity(0.4)':'none',transition:'filter 0.3s',
          boxShadow:won?'0 0 60px var(--amber-glow)':'0 8px 40px rgba(0,0,0,0.6)'}}>
          {board.map((row,r) => row.map((val,c) => {
            const key=`${r}-${c}`,isGiven=given&&given.has(key)
            const isSel=selected&&selected[0]===r&&selected[1]===c
            const isErr=errors.has(key),hl=isHL(r,c)
            const sameNum=highlightNum&&val===highlightNum
            const cellNotes=notes[key]
            let bg='var(--surface)'
            if(isSel) bg='rgba(232,168,56,0.22)'
            else if(sameNum) bg='rgba(232,168,56,0.15)'
            else if(hl) bg='var(--surface2)'
            const color=isGiven?'var(--given)':isErr?'var(--wrong)':'var(--amber2)'
            return (
              <div key={key} onClick={()=>{setSelected([r,c]);if(val!==0)setHighlightNum(val);else setHighlightNum(null)}}
                style={{width:'var(--cell-size)',height:'var(--cell-size)',background:bg,...BT(r,c),
                  display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',
                  position:'relative',transition:'background 0.1s',userSelect:'none',
                  outline:isSel?'2px solid var(--amber)':'none',outlineOffset:'-2px',zIndex:isSel?1:0}}>
                {val!==0?(
                  <span style={{fontFamily:'var(--font-serif)',fontSize:'clamp(16px,4vw,28px)',fontWeight:isGiven?600:400,color,lineHeight:1,
                    animation:!isGiven?'popIn 0.15s ease':'none'}}>{val}</span>
                ):cellNotes&&cellNotes.size>0?(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',width:'88%',height:'88%'}}>
                    {[1,2,3,4,5,6,7,8,9].map(n=>(
                      <span key={n} style={{fontFamily:'var(--font-mono)',fontSize:'clamp(5px,1vw,7px)',
                        color:cellNotes.has(n)?'var(--amber)':'transparent',
                        display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>{n}</span>
                    ))}
                  </div>
                ):null}
              </div>
            )
          }))}
        </div>

        <div style={{display:'flex',gap:'clamp(4px,1.2vw,7px)',justifyContent:'center'}}>
          {[1,2,3,4,5,6,7,8,9].map(n => {
            const cnt=board.flat().filter(v=>v===n).length,done=cnt>=9
            return (
              <button key={n} onClick={()=>handleInput(n)} disabled={done} style={{
                width:'clamp(34px,8.5vw,50px)',height:'clamp(42px,10vw,60px)',
                background:done?'var(--bg2)':highlightNum===n?'var(--amber-dim)':'var(--surface2)',
                border:`1px solid ${done?'var(--border)':highlightNum===n?'var(--amber)':'var(--border2)'}`,
                color:done?'var(--border2)':'var(--text)',fontFamily:'var(--font-serif)',
                fontSize:'clamp(16px,4vw,24px)',cursor:done?'default':'pointer',borderRadius:'2px',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'1px',
                transition:'all 0.15s',
              }}>
                {n}
                {!done&&<span style={{fontFamily:'var(--font-mono)',fontSize:'6px',color:'var(--muted)'}}>{9-cnt}</span>}
              </button>
            )
          })}
        </div>

        <div style={{display:'flex',gap:'6px',flexWrap:'wrap',justifyContent:'center'}}>
          {[
            {label:'Undo',icon:'↩',fn:undo},
            {label:'Erase',icon:'⌫',fn:()=>handleInput(0)},
            {label:noteMode?'Notes ✓':'Notes',icon:'✎',fn:()=>setNoteMode(m=>!m),active:noteMode},
            {label:'Hint',icon:'◈',fn:reveal},
            {label:'New',icon:'⊕',fn:()=>fetchPuzzle(difficulty)},
          ].map(btn=>(
            <button key={btn.label} onClick={btn.fn} style={{
              padding:'7px 14px',borderRadius:'2px',cursor:'pointer',transition:'all 0.15s',
              background:btn.active?'var(--amber-dim)':'var(--surface)',
              border:`1px solid ${btn.active?'var(--amber)':'var(--border2)'}`,
              color:btn.active?'var(--amber)':'var(--muted2)',
              fontFamily:'var(--font-mono)',fontSize:'8px',letterSpacing:'0.12em',textTransform:'uppercase',
              display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',minWidth:'48px',
            }}>
              <span style={{fontSize:'14px'}}>{btn.icon}</span>
              {btn.label}
            </button>
          ))}
        </div>

        <p style={{fontFamily:'var(--font-mono)',fontSize:'8px',color:'var(--muted)',letterSpacing:'0.1em',textAlign:'center'}}>
          ARROWS · 1-9 · BACKSPACE · N = NOTES · CTRL+Z = UNDO
        </p>
      </div>

      {won&&(
        <div style={{position:'fixed',inset:0,zIndex:100,background:'rgba(12,10,8,0.9)',display:'flex',
          flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'24px',backdropFilter:'blur(8px)'}}>
          <div style={{textAlign:'center'}}>
            <div style={{fontFamily:'var(--font-serif)',fontSize:'clamp(3rem,10vw,6rem)',color:'var(--amber)',lineHeight:1}}>✦</div>
            <h2 style={{fontFamily:'var(--font-serif)',fontSize:'clamp(2rem,7vw,4rem)',fontWeight:300,color:'var(--text)',letterSpacing:'0.4em',textTransform:'uppercase',marginTop:'8px'}}>Solved</h2>
            <p style={{fontFamily:'var(--font-mono)',fontSize:'10px',color:'var(--muted)',letterSpacing:'0.18em',marginTop:'10px',textTransform:'uppercase'}}>Difficulty: {difficulty} · Mistakes: {mistakes}</p>
          </div>
          <div style={{display:'flex',gap:'10px',flexWrap:'wrap',justifyContent:'center'}}>
            {DIFFICULTIES.map(d=>(
              <button key={d} onClick={()=>{setDifficulty(d);fetchPuzzle(d)}} style={{
                padding:'9px 20px',borderRadius:'2px',cursor:'pointer',
                background:d===difficulty?'var(--amber)':'var(--surface2)',
                color:d===difficulty?'#12100e':'var(--muted2)',
                border:`1px solid ${d===difficulty?'var(--amber)':'var(--border)'}`,
                fontFamily:'var(--font-mono)',fontSize:'9px',letterSpacing:'0.12em',
                textTransform:'uppercase',fontWeight:d===difficulty?700:400,
              }}>{d}</button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes popIn { 0%{transform:scale(0.4);opacity:0} 100%{transform:scale(1);opacity:1} }
        button:hover:not(:disabled) { opacity: 0.82; }
        button:active:not(:disabled) { transform: scale(0.97); }
      `}</style>
    </div>
  )
}
