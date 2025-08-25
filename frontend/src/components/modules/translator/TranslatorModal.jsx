import React, { useState } from 'react'

const LANGUAGES = [
  'Elvish',
  'Dwarvish',
  'Draconic',
  'Infernal',
  'Celestial',
  'Giant',
]

function randomGlyph(len){
  const glyphs = "ρ σ ϟ Ѧ Ҩ ϻ Ϫ ɸ ɣ ʒ Ᵽ Ɐ ɴ ȶ".split(' ')
  let out = ''
  for (let i=0;i<len;i++) out += glyphs[Math.floor(Math.random()*glyphs.length)]
  return out
}

function mockTranslate(text, lang){
  if (!text) return ''
  const words = text.split(/\s+/)
  switch(lang){
    case 'Elvish':
      // flowing diacritics and doubled vowels
      return words.map(w => w.split('').map((c,i)=> (/[aeiou]/i.test(c) ? c + '́' : c)).join('')).join(' ')
    case 'Dwarvish':
      // blocky runes (use doubled consonants and heavy glyphs)
      return words.map(w => w.replace(/([bcdfghjklmnpqrstvwxyz])/gi, (c)=>c+c)).join(' ')
    case 'Draconic':
      // dragon-scratch glyphs: random glyphs with apostrophes
      return words.map(w => randomGlyph(Math.max(3, Math.min(8, Math.floor(w.length/1.2)))) + "'").join(' ')
    case 'Infernal':
      // jagged: mix punctuation with letters
      return words.map(w => w.split('').map(c => (Math.random()>0.6? '~':'') + c).join('')).join(' ')
    case 'Celestial':
      // soft, starry script: add circles and small diacritics
      return words.map(w => '◌' + w.split('').join('◦')).join(' ')
    case 'Giant':
      // loud and all-caps with extra exclamation glyphs
      return words.map(w => w.toUpperCase() + '‼').join(' ')
    default:
      return text
  }
}

function mockPronunciation(translated, lang){
  // Generate a pronunciation that reflects how the translated (fantasy) text would sound.
  if (!translated) return ''
  const pools = {
    Elvish: ['ae','li','ra','el','ion','eth','ia','ar'],
    Dwarvish: ['dor','gim','ruk','bar','un','th','gor'],
    Draconic: ['su','ji','na','ack','gar','rax','zor','th'],
    Infernal: ['kh','zha','urr','ix','ash','zek'],
    Celestial: ['li','ea','so','el','ae','ion'],
    Giant: ['GRA','MOR','THA','KOR']
  }

  const pool = pools[lang] || ['la','na','ra']

  // Tokenize translated text by words or glyph groups
  const tokens = String(translated).split(/\s+/).filter(Boolean)

  const pronounceToken = (t) => {
    // If token contains ASCII letters, break into pseudo-syllables based on length
    const hasAscii = /[a-zA-Z]/.test(t)
    if (hasAscii) {
      const clean = t.replace(/[^a-zA-Z']/g,'')
      const parts = []
      let i = 0
      while (i < clean.length) {
        const chunk = clean.slice(i, i+Math.max(1, Math.floor(Math.random()*2)+1))
        parts.push(chunk.toLowerCase())
        i += chunk.length
      }
      // map parts to pronounceable syllables
      return parts.map((p, idx) => {
        const pick = pool[(p.charCodeAt(0) + idx) % pool.length]
        return (p.replace(/[^aeiouy]/gi, '') ? p.replace(/([aeiouy])/gi,'$1-') : p) + pick
      }).join('-')
    }

    // For glyphs/symbols, map each glyph to a syllable from pool deterministically
    let seed = 0
    for (let i=0;i<t.length;i++) seed += t.charCodeAt(i)
    const parts = []
    const syllCount = Math.max(1, Math.min(4, Math.floor(t.length/2)))
    for (let s=0;s<syllCount;s++) {
      parts.push(pool[(seed + s) % pool.length])
    }
    return parts.join('-')
  }

  return tokens.map(pronounceToken).join(' ')
}

export default function TranslatorModal({open, onClose}){
  const [selected, setSelected] = useState(LANGUAGES[0])
  const [text, setText] = useState('')

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
          <div className="bg-base-200 p-3 rounded h-36 overflow-auto">{translated || <span className="text-sm text-muted">Translation preview</span>}</div>
          <div className="mt-2 text-xs text-muted">Pronunciation</div>
          <div className="bg-base-200 p-2 rounded mt-1">{pron || <span className="text-sm text-muted">Pronunciation preview</span>}</div>
        </div>

        <div className="col-span-3 flex justify-end space-x-2 mt-3">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={send}>Send Message</button>
        </div>
      </div>
    </div>
  )
}
