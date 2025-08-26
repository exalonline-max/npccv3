import React, { useState } from 'react'

const LANGUAGES = [
  'Elvish',
  'Dwarvish',
  'Draconic',
  'Infernal',
  'Celestial',
  'Giant',
]

function randomGlyph(len, pool){
  let out = ''
  for (let i=0;i<len;i++) out += pool[Math.floor(Math.random()*pool.length)]
  return out
}

// letter-to-glyph maps for non-Draconic languages
const MAPS = {
  Elvish: {
    a:'å',b:'ƅ',c:'ċ',d:'ď',e:'ę',f:'ƒ',g:'ĝ',h:'ħ',i:'į',j:'ĵ',k:'ķ',l:'ł',m:'ṃ',n:'ñ',o:'ø',p:'þ',q:'q̇',r:'ř',s:'ś',t:'ŧ',u:'ū',v:'ṽ',w:'ŵ',x:'χ',y:'ÿ',z:'ž'
  },
  Dwarvish: {
    a:'ᚨ',b:'ᛒ',c:'ᚲ',d:'ᛞ',e:'ᛖ',f:'ᚠ',g:'ᚷ',h:'ᚺ',i:'ᛁ',j:'ᛃ',k:'ᚲ',l:'ᛚ',m:'ᛗ',n:'ᚾ',o:'ᛟ',p:'ᛈ',q:'ᛩ',r:'ᚱ',s:'ᛋ',t:'ᛏ',u:'ᚢ',v:'ᚡ',w:'ᚹ',x:'ᛪ',y:'ᛦ',z:'ᛉ'
  },
  Infernal: {
    a:'α',b:'в',c:'ς',d:'δ',e:'ε',f:'ғ',g:'ɠ',h:'ħ',i:'ι',j:'ϳ',k:'ƙ',l:'λ',m:'м',n:'η',o:'σ',p:'ρ',q:'ϙ',r:'ʀ',s:'ѕ',t:'τ',u:'υ',v:'ν',w:'ω',x:'χ',y:'ψ',z:'ż'
  },
  Celestial: {
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ғ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'s',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
  },
  Giant: {
    a:'Δ',b:'Β',c:'Ͼ',d:'Đ',e:'Ξ',f:'Ғ',g:'Ĝ',h:'Ħ',i:'Ι',j:'Ĵ',k:'Κ',l:'Ŀ',m:'М',n:'И',o:'Θ',p:'Ƥ',q:'Ϙ',r:'Ř',s:'Ŝ',t:'Ŧ',u:'Ц',v:'Ѵ',w:'Ш',x:'Ж',y:'Ψ',z:'Ẕ'
  }
}

function mapWordToGlyphs(word, map){
  if (!word) return ''
  let out = ''
  for (let ch of word.toLowerCase()){
    if (/[a-z]/.test(ch)) out += (map[ch] || ch)
    else out += ch
  }
  return out
}

// Seeded pseudo-random generator (LCG) for deterministic obfuscation per word
function seededRandom(seed){
  let s = seed >>> 0
  return function(){
    s = (s * 1664525 + 1013904223) >>> 0
    return (s & 0x7fffffff) / 0x7fffffff
  }
}

function scrambleWord(word, map, lang){
  if (!word) return ''
  // create a stable seed from word + lang so same word maps consistently
  let seed = lang.length
  for (let i=0;i<word.length;i++) seed = (seed * 31 + word.charCodeAt(i)) >>> 0
  const rnd = seededRandom(seed)

  const pool = Object.values(map).filter(Boolean)
  const extras = ['·','•','˙','⁂','✶','~','`','-']
  const outPieces = []

  // decide number of clusters based on word length
  const clusters = Math.max(1, Math.round(word.length / (1 + Math.floor(rnd()*2))))
  for (let c=0;c<clusters;c++){
    let piece = ''
    const pieceLen = 1 + Math.floor(rnd() * Math.max(1, Math.floor(word.length/2)))
    for (let i=0;i<pieceLen;i++){
      const pick = pool[Math.floor(rnd()*pool.length)] || word[i] || ''
      // occasionally insert an extra diacritic or modifier
      if (rnd() < 0.25) piece += (pick + extras[Math.floor(rnd()*extras.length)])
      else piece += pick
    }
    // with small chance, reverse piece to add noise
    if (rnd() < 0.2) piece = piece.split('').reverse().join('')
    outPieces.push(piece)
  }

  // join pieces with a thin separator to preserve visible word boundaries
  return outPieces.join('·')
}

function mockTranslate(text, lang){
  if (!text) return ''
  // split into sentences so we preserve sentence-per-line behavior
  const sentences = text.split(/(?<=[.!?])\s+/)
  const out = sentences.map(sentence => {
    const words = sentence.split(/\s+/).filter(Boolean)
    switch(lang){
        case 'Draconic':{
          const pool = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ϟ','ཉ','Ҩ','ȶ','ɸ','ʒ','ɣ']
          return words.map(w => randomGlyph(Math.max(3, Math.min(10, Math.floor(w.length/0.9))), pool) + "˙").join(' ')
        }
        case 'Elvish':{
          return words.map(w => scrambleWord(w, MAPS.Elvish, 'Elvish')).join(' ')
        }
        case 'Dwarvish':{
          return words.map(w => scrambleWord(w, MAPS.Dwarvish, 'Dwarvish')).join(' ')
        }
        case 'Infernal':{
          return words.map(w => scrambleWord(w, MAPS.Infernal, 'Infernal')).join(' ')
        }
        case 'Celestial':{
          return words.map(w => scrambleWord(w, MAPS.Celestial, 'Celestial')).join(' ')
        }
        case 'Giant':{
          return words.map(w => scrambleWord(w, MAPS.Giant, 'Giant')).join(' ')
        }
      default:
        return sentence
    }
  })
  return out.join('\n')
}
  function mockPronunciation(translated, lang){
    if (!translated) return ''

    // richer syllable pools per language (consonant+vowel fragments and standalone syllables)
    const SYLL_POOLS = {
      Elvish: ['la','le','ri','ra','na','ni','el','eth','iel','ae','lyn','syl','wen','thae','or'],
      Dwarvish: ['bar','bur','dok','grom','mak','ruk','thor','grim','dug','kor','bal','nak','zug','mok','gar'],
      Draconic: ['suu','rax','gar','shi','nok','shar','thu','zar','ikk','uur','dra','ven','syr','gor','thak'],
      Infernal: ['khul','raz','iz','vor','thak','zil','az','ur','xen','ith','kar','esh','om','rak','zin'],
      Celestial: ['el','ion','aer','lia','so','riel','ae','ora','ion','lys','sel','mir','hal','orae','une'],
      Giant: ['gra','mor','tha','kor','ruk','gor','hul','vak','dra','rok','bar','thul','kran','gak','vor']
    }

    const lines = String(translated).split(/\n+/).filter(Boolean)

    return lines.map(line => {
      // derive a deterministic seed from the line so pronunciation is stable
      let seed = 2166136261 >>> 0
      for (let i=0;i<line.length;i++) seed = ((seed ^ line.charCodeAt(i)) * 16777619) >>> 0

      const rnd = seededRandom(seed)
      const pool = SYLL_POOLS[lang] || SYLL_POOLS.Elvish

      // estimate number of syllables from visible glyph count (longer translations -> more sylls)
      const visible = line.replace(/[^\p{L}\p{N}]/gu, '')
      const est = Math.max(4, Math.min(12, Math.floor(visible.length / 2) + 2))
      // add a small jitter from seed
      const sylCount = Math.max(4, Math.min(14, est + Math.floor(rnd()*3) - 1))

      const syls = []
      for (let i=0;i<sylCount;i++){
        // pick a syllable deterministically
        const pick = pool[(Math.floor((seed/((i+1)||1)) + i) >>> 0) % pool.length]
        // occasionally append a vowel-glide or lengthener
        if (rnd() < 0.15) syls.push(pick + (rnd() < 0.5 ? 'a' : 'o'))
        else if (rnd() < 0.1) syls.push(pick.toUpperCase())
        else syls.push(pick)
      }

      // join with hyphens to make it readable but long enough
      return syls.join('-')
    }).join('\n')
  }

export default function TranslatorModal({open, onClose}){
  const [selected, setSelected] = useState(LANGUAGES[0])
  const [text, setText] = useState('')

  React.useEffect(()=>{
    if (!open) return
    function onKey(e){
      if (e.key === 'Escape') onClose && onClose()
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const translated = mockTranslate(text, selected)
  const pron = mockPronunciation(translated, selected)

  function send(){
    if (!text.trim()) return
    // Dispatch a global event so ChatLog can append it.
    const payload = {
      id: Date.now(),
      author: 'You',
      type: 'msg',
      original: text,
      translated,
      lang: selected,
      pronunciation: pron,
    }
    window.dispatchEvent(new CustomEvent('npcchatter:message', {detail: payload}))
    setText('')
    onClose && onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded shadow-lg w-10/12 max-w-4xl p-4 grid grid-cols-3 gap-4">
        <div className="col-span-1 overflow-auto">
          <div className="font-semibold mb-2">Languages</div>
          <div className="space-y-1">
            {LANGUAGES.map(l => (
              <button key={l} onClick={()=>setSelected(l)} className={`w-full text-left btn btn-ghost ${selected===l? 'btn-active':''}`}>{l}</button>
            ))}
          </div>
        </div>

        <div className="col-span-1">
          <div className="font-semibold mb-2">Input</div>
          <textarea className="textarea w-full h-48" value={text} onChange={e=>setText(e.target.value)} />
        </div>

        <div className="col-span-1">
          <div className="font-semibold mb-2">Translation ({selected})</div>
          <div className="bg-base-200 p-3 rounded h-56 overflow-auto whitespace-pre-wrap">{translated || <span className="text-sm text-muted">Translation preview</span>}</div>
          <div className="mt-2 text-xs text-muted">Pronunciation</div>
          <div className="bg-base-200 p-2 rounded mt-1 h-28 overflow-auto whitespace-pre-wrap">{pron || <span className="text-sm text-muted">Pronunciation preview</span>}</div>
        </div>

        <div className="col-span-3 flex justify-end space-x-2 mt-3">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary flex items-center gap-2" onClick={send} aria-label="Send translated message" title="Send message">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M2 21l21-9L2 3v7l15 2-15 2v6z" />
            </svg>
            <span className="sr-only">Send message</span>
          </button>
        </div>
      </div>
    </div>
  )
}
